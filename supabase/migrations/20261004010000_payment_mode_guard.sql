-- Migration: 20261004010000_payment_mode_guard.sql
-- Description: Never pay out (or auto-refund) money for TEST-mode payments
-- with LIVE keys, or the other way round.
--
-- Production took Paystack test-mode payments before going live. Those rows
-- look like real settled payments, so without this guard switching payouts
-- on would transfer real money to hosts for test tickets.
--
-- - payments.paystack_mode: 'test' or 'live', set by
--   initialize-paystack-transaction from the secret key in use. Existing rows
--   stay NULL (unknown) and are never paid out or auto-refunded.
-- - platform_settings.payments.payout_mode (default 'live'): only payments of
--   this mode are scheduled for host payouts. A staging project using test
--   keys sets it to 'test' to rehearse payouts with Paystack test transfers.
-- - payment-jobs only submits refunds for payments made in the same mode as
--   its current secret key (enforced in _shared/paymentJobs.ts).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paystack_mode text;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_paystack_mode_chk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_paystack_mode_chk CHECK (paystack_mode IS NULL OR paystack_mode IN ('test', 'live'));

UPDATE public.platform_settings
SET value = value || '{"payout_mode": "live"}'::jsonb, updated_at = now()
WHERE key = 'payments' AND NOT (value ? 'payout_mode');

-- Same as 20261004000000, plus the payment-mode filter.
CREATE OR REPLACE FUNCTION public.schedule_host_payouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delay int := coalesce((public.payment_setting('payout_delay_hours') #>> '{}')::int, 48);
  v_mode text := coalesce(public.payment_setting('payout_mode') #>> '{}', 'live');
  r record;
  v_payout uuid;
  v_count int := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('leenkit_schedule_host_payouts'));

  FOR r IN
    SELECT p.hangout_id, coalesce(p.host_id, h.host_id) AS host_id, p.currency,
           sum(p.host_amount) AS total,
           public.hangout_starts_at(p.hangout_id) AS starts_at
    FROM public.payments p
    JOIN public.hangouts h ON h.id = p.hangout_id
    WHERE p.status = 'successful'
      AND p.payout_id IS NULL
      AND p.paystack_mode = v_mode
      AND p.host_amount IS NOT NULL AND p.host_amount > 0
      AND h.status <> 'cancelled'
    GROUP BY p.hangout_id, coalesce(p.host_id, h.host_id), p.currency
  LOOP
    CONTINUE WHEN r.starts_at IS NULL OR now() < r.starts_at + make_interval(hours => v_delay);

    INSERT INTO public.host_payouts (host_id, hangout_id, amount, currency, status, recipient_code,
                                     transfer_reference, available_at, failure_reason)
    SELECT r.host_id, r.hangout_id, r.total, r.currency,
           CASE WHEN a.paystack_recipient_code IS NULL THEN 'needs_review' ELSE 'scheduled' END,
           a.paystack_recipient_code,
           'LKP_' || replace(gen_random_uuid()::text, '-', ''),
           r.starts_at + make_interval(hours => v_delay),
           CASE WHEN a.paystack_recipient_code IS NULL THEN 'host_has_no_payout_recipient' END
    FROM (SELECT 1) one
    LEFT JOIN public.host_payout_accounts a ON a.user_id = r.host_id
    RETURNING id INTO v_payout;

    UPDATE public.payments
    SET payout_id = v_payout, updated_at = now()
    WHERE hangout_id = r.hangout_id AND currency = r.currency
      AND status = 'successful' AND payout_id IS NULL
      AND paystack_mode = v_mode
      AND host_amount IS NOT NULL AND host_amount > 0;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_host_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_host_payouts() TO service_role;
