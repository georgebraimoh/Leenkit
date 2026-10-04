-- Migration: 20261004000000_refunds_and_held_payouts.sql
-- Description: Owner-approved refund policy and held host payouts.
--
-- Policy (owner decision, 2026-10-04):
--   * Host (or LEENKIT) cancels a Hangout -> every paid ticket and paid
--     sponsorship is refunded in FULL.
--   * LEENKIT cannot confirm a buyer's spot (full, closed, already going) ->
--     FULL refund.
--   * Attendee/sponsor leaves at least `leave_cutoff_hours` (24h) before the
--     start -> refund of the amount paid minus LEENKIT's platform fee.
--     Leaving later -> no refund.
--   * Host money is HELD: LEENKIT collects the whole payment (no split), and
--     pays the host's share by Paystack Transfer `payout_delay_hours` (48h)
--     after the Hangout starts, minus refunds.
--
-- Mechanics:
--   * payments.status 'requires_refund' + refund_amount/refund_status form
--     the refund queue. The payment-jobs Edge Function submits refunds to
--     the Paystack Refund API; refund.* webhooks complete them.
--   * host_payouts is the payout ledger. schedule_host_payouts() groups a
--     Hangout's settled, unrefunded payments into a payout once it is due;
--     payment-jobs sends it by Paystack Transfer (only when
--     platform_settings.payments.payouts_enabled = true); transfer.*
--     webhooks complete it.
--   * A Hangout cannot be cancelled once a payout for it is being sent or
--     has been paid (refunds would otherwise come from LEENKIT's balance).
--
-- Times: hangouts.date/time have no time zone; they are interpreted in
-- platform_settings.payments.timezone (default Africa/Lagos).
-- Forward-only; existing rows are not modified.

-- ---------------------------------------------------------------------------
-- 0. Settings
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value) VALUES
  ('payments', '{"leave_cutoff_hours": 24, "payout_delay_hours": 48, "timezone": "Africa/Lagos", "refunds_enabled": true, "payouts_enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.payment_setting(p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT value -> p_key FROM public.platform_settings WHERE key = 'payments';
$$;

REVOKE ALL ON FUNCTION public.payment_setting(text) FROM PUBLIC, anon, authenticated;

-- Start of a Hangout as an absolute time.
CREATE OR REPLACE FUNCTION public.hangout_starts_at(p_hangout_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ((h.date + coalesce(h.time, time '00:00')) AT TIME ZONE
          coalesce(public.payment_setting('timezone') #>> '{}', 'Africa/Lagos'))
  FROM public.hangouts h
  WHERE h.id = p_hangout_id AND h.date IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.hangout_starts_at(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hangout_starts_at(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. Payout ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.host_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  hangout_id uuid NOT NULL REFERENCES public.hangouts (id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'processing', 'paid', 'failed', 'needs_review', 'cancelled')),
  recipient_code text,
  transfer_reference text NOT NULL UNIQUE,
  paystack_transfer_code text,
  attempts integer NOT NULL DEFAULT 0,
  failure_reason text,
  available_at timestamptz NOT NULL,
  processing_started_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS host_payouts_host_idx ON public.host_payouts (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS host_payouts_due_idx ON public.host_payouts (status, available_at);
CREATE INDEX IF NOT EXISTS host_payouts_hangout_idx ON public.host_payouts (hangout_id);

ALTER TABLE public.host_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "host_payouts_select_own" ON public.host_payouts;
CREATE POLICY "host_payouts_select_own"
  ON public.host_payouts FOR SELECT
  TO authenticated
  USING (host_id = auth.uid() OR public.is_admin());

-- Written only by SECURITY DEFINER functions and the service role.
REVOKE ALL ON TABLE public.host_payouts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.host_payouts TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Payments: refund queue + payout link
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refund_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_status text,
  ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_last_error text,
  ADD COLUMN IF NOT EXISTS paystack_refund_id text,
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES public.host_payouts (id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_refund_status_chk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_refund_status_chk CHECK (
    refund_status IS NULL OR refund_status IN
      ('queued', 'submitting', 'pending', 'processing', 'processed', 'failed', 'needs_review')
  );

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_refund_amount_chk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_refund_amount_chk CHECK (refund_amount IS NULL OR (refund_amount > 0 AND refund_amount <= amount));

CREATE INDEX IF NOT EXISTS payments_refund_queue_idx
  ON public.payments (refund_status, refund_requested_at)
  WHERE status = 'requires_refund';
CREATE INDEX IF NOT EXISTS payments_payout_idx ON public.payments (payout_id);

-- Any move into 'requires_refund' queues a refund. The amount defaults to
-- the full payment (cancellation, unconfirmed spot); leave_hangout() sets a
-- smaller amount (minus the platform fee) before the status change.
CREATE OR REPLACE FUNCTION public.payments_queue_refund()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'requires_refund' AND OLD.status IS DISTINCT FROM 'requires_refund' THEN
    NEW.refund_amount := coalesce(NEW.refund_amount, NEW.amount);
    NEW.refund_reason := coalesce(NEW.refund_reason, NEW.metadata->>'refund_reason', 'not_confirmed');
    NEW.refund_status := coalesce(NEW.refund_status, 'queued');
    NEW.refund_requested_at := coalesce(NEW.refund_requested_at, now());
  END IF;
  IF NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded' THEN
    NEW.refund_status := 'processed';
    NEW.refunded_at := coalesce(NEW.refunded_at, now());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payments_queue_refund() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_queue_refund ON public.payments;
CREATE TRIGGER payments_queue_refund
  BEFORE UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE public.payments_queue_refund();

-- settle_payment() INSERTs nothing into payments, it UPDATEs status, so the
-- trigger above also covers spots that could not be confirmed.

-- ---------------------------------------------------------------------------
-- 3. Cancellation: full refunds for tickets AND sponsorships
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.flag_refunds_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Undo payouts that have not started (they are blocked once sending).
  UPDATE public.payments SET payout_id = NULL
  WHERE payout_id IN (
    SELECT id FROM public.host_payouts
    WHERE hangout_id = NEW.id AND status IN ('scheduled', 'failed', 'needs_review')
  );
  UPDATE public.host_payouts
  SET status = 'cancelled', updated_at = now(), failure_reason = 'hangout_cancelled'
  WHERE hangout_id = NEW.id AND status IN ('scheduled', 'failed', 'needs_review');

  UPDATE public.payments
  SET status = 'requires_refund',
      refund_amount = amount,
      refund_reason = 'hangout_cancelled',
      metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"hangout_cancelled"}'::jsonb,
      updated_at = now()
  WHERE hangout_id = NEW.id
    AND payment_type IN ('ticket', 'sponsorship')
    AND status = 'successful';

  UPDATE public.hangout_sponsorships
  SET status = 'requires_refund', updated_at = now()
  WHERE hangout_id = NEW.id AND status = 'paid';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_refunds_on_cancel() FROM PUBLIC, anon, authenticated;

-- No cancellation once a payout is being sent or has been paid.
CREATE OR REPLACE FUNCTION public.hangouts_block_cancel_after_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled'
     AND EXISTS (SELECT 1 FROM public.host_payouts
                 WHERE hangout_id = NEW.id AND status IN ('processing', 'paid')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_PAYOUT_ALREADY_SENT';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangouts_block_cancel_after_payout() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_block_cancel_after_payout ON public.hangouts;
CREATE TRIGGER hangouts_block_cancel_after_payout
  BEFORE UPDATE OF status ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.hangouts_block_cancel_after_payout();

-- ---------------------------------------------------------------------------
-- 4. Leaving: refund preview + leave (with refund when eligible)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leave_refund_preview(p_hangout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_start timestamptz;
  v_cutoff_hours int := coalesce((public.payment_setting('leave_cutoff_hours') #>> '{}')::int, 24);
  v_deadline timestamptz;
  v_paid numeric := 0;
  v_refund numeric := 0;
  v_currency text := 'NGN';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_start := public.hangout_starts_at(p_hangout_id);
  v_deadline := v_start - make_interval(hours => v_cutoff_hours);

  SELECT coalesce(sum(amount), 0),
         coalesce(sum(greatest(amount - coalesce(platform_fee, 0), 0)), 0),
         coalesce(max(currency), 'NGN')
  INTO v_paid, v_refund, v_currency
  FROM public.payments
  WHERE user_id = v_uid AND hangout_id = p_hangout_id AND status = 'successful' AND payout_id IS NULL;

  RETURN jsonb_build_object(
    'paid', v_paid,
    'currency', v_currency,
    'eligible', v_paid > 0 AND v_start IS NOT NULL AND now() <= v_deadline,
    'refund_amount', CASE WHEN v_paid > 0 AND v_start IS NOT NULL AND now() <= v_deadline THEN v_refund ELSE 0 END,
    'deadline', v_deadline,
    'cutoff_hours', v_cutoff_hours
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_leave_refund_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leave_refund_preview(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_hangout(p_hangout_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_host uuid;
  v_status text;
  v_preview jsonb;
  v_refunded numeric := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT host_id, status INTO v_host, v_status FROM public.hangouts WHERE id = p_hangout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_HANGOUT_NOT_FOUND';
  END IF;
  IF v_host = v_uid THEN
    RAISE EXCEPTION 'The host cannot leave their own Hangout';
  END IF;

  v_preview := public.get_leave_refund_preview(p_hangout_id);

  -- Refunds only while the Hangout is still on (cancelled Hangouts are
  -- already fully refunded by flag_refunds_on_cancel).
  IF v_status = 'upcoming' AND (v_preview->>'eligible')::boolean THEN
    UPDATE public.payments
    SET refund_amount = greatest(amount - coalesce(platform_fee, 0), 0.01),
        refund_reason = 'attendee_left',
        metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"attendee_left"}'::jsonb,
        status = 'requires_refund',
        updated_at = now()
    WHERE user_id = v_uid AND hangout_id = p_hangout_id AND status = 'successful' AND payout_id IS NULL;

    UPDATE public.hangout_sponsorships
    SET status = 'requires_refund', updated_at = now()
    WHERE hangout_id = p_hangout_id AND sponsor_id = v_uid AND status = 'paid';

    v_refunded := (v_preview->>'refund_amount')::numeric;
  END IF;

  DELETE FROM public.hangout_attendees WHERE hangout_id = p_hangout_id AND user_id = v_uid;

  RETURN jsonb_build_object(
    'left', true,
    'refund_amount', v_refunded,
    'currency', v_preview->>'currency',
    'paid', (v_preview->>'paid')::numeric
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_hangout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_hangout(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Scheduling payouts (service role; called by payment-jobs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.schedule_host_payouts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delay int := coalesce((public.payment_setting('payout_delay_hours') #>> '{}')::int, 48);
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
      AND host_amount IS NOT NULL AND host_amount > 0;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_host_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_host_payouts() TO service_role;

-- ---------------------------------------------------------------------------
-- 6. Host payout accounts: Paystack transfer recipients (no subaccounts)
-- ---------------------------------------------------------------------------
ALTER TABLE public.host_payout_accounts
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text;
ALTER TABLE public.host_payout_accounts
  ALTER COLUMN paystack_subaccount_code DROP NOT NULL;

-- Paid Hangouts need a payout account that can receive transfers.
CREATE OR REPLACE FUNCTION public.check_paid_hangout_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_min numeric;
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR NOT coalesce(NEW.is_paid, false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.is_paid, NEW.price, NEW.currency) IS NOT DISTINCT FROM (OLD.is_paid, OLD.price, OLD.currency) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.host_payout_accounts
                 WHERE user_id = NEW.host_id AND paystack_recipient_code IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_PAYOUT_SETUP_REQUIRED';
  END IF;

  IF coalesce(NEW.currency, 'NGN') <> 'NGN' THEN
    RAISE EXCEPTION 'Paid Hangouts are priced in NGN for now';
  END IF;

  SELECT coalesce((value->>'min_payment_ngn')::numeric, 1000) INTO v_min
  FROM public.platform_settings WHERE key = 'platform_fee';

  IF NEW.price < coalesce(v_min, 1000) THEN
    RAISE EXCEPTION 'Ticket price must be at least NGN %', coalesce(v_min, 1000);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Host earnings: held vs paid out
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_host_earnings();
CREATE FUNCTION public.get_host_earnings()
RETURNS TABLE (
  currency text,
  tickets_sold bigint,
  sponsorships bigint,
  gross numeric,
  platform_fees numeric,
  host_earnings numeric,
  pending_refunds bigint,
  paid_out numeric,
  to_be_paid numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.currency,
    count(*) FILTER (WHERE p.payment_type = 'ticket' AND p.status = 'successful'),
    count(*) FILTER (WHERE p.payment_type = 'sponsorship' AND p.status = 'successful'),
    coalesce(sum(p.amount) FILTER (WHERE p.status = 'successful'), 0),
    coalesce(sum(p.platform_fee) FILTER (WHERE p.status = 'successful'), 0),
    coalesce(sum(p.host_amount) FILTER (WHERE p.status = 'successful'), 0),
    count(*) FILTER (WHERE p.status = 'requires_refund'),
    coalesce(sum(p.host_amount) FILTER (WHERE p.status = 'successful' AND hp.status = 'paid'), 0),
    coalesce(sum(p.host_amount) FILTER (WHERE p.status = 'successful' AND (hp.id IS NULL OR hp.status <> 'paid')), 0)
  FROM public.payments p
  LEFT JOIN public.host_payouts hp ON hp.id = p.payout_id
  WHERE p.host_id = auth.uid()
    AND p.host_amount IS NOT NULL
  GROUP BY p.currency;
$$;

REVOKE ALL ON FUNCTION public.get_host_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_host_earnings() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Admin: refunds and payouts needing attention
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_retry_refund(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  UPDATE public.payments
  SET refund_status = 'queued', refund_last_error = NULL, updated_at = now()
  WHERE id = p_payment_id AND status = 'requires_refund'
    AND refund_status IN ('failed', 'needs_review');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only failed or reviewed refunds can be retried';
  END IF;
  PERFORM public.admin_audit('retry_refund', 'payment', p_payment_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_payouts(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid, created_at timestamptz, status text, amount numeric, currency text,
  available_at timestamptz, paid_at timestamptz, failure_reason text, attempts integer,
  hangout_id uuid, hangout_title text, host_name text, transfer_reference text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT hp.id, hp.created_at, hp.status, hp.amount, hp.currency, hp.available_at, hp.paid_at,
         hp.failure_reason, hp.attempts, hp.hangout_id, h.title, pr.name, hp.transfer_reference
  FROM public.host_payouts hp
  LEFT JOIN public.hangouts h ON h.id = hp.hangout_id
  LEFT JOIN public.profiles pr ON pr.id = hp.host_id
  WHERE p_status IS NULL OR hp.status = p_status
  ORDER BY hp.created_at DESC
  LIMIT 500;
END;
$$;

-- Retry a failed / reviewed payout with a fresh transfer reference.
CREATE OR REPLACE FUNCTION public.admin_retry_payout(p_payout_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  SELECT a.paystack_recipient_code INTO v_recipient
  FROM public.host_payouts hp
  LEFT JOIN public.host_payout_accounts a ON a.user_id = hp.host_id
  WHERE hp.id = p_payout_id;

  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'The host has no payout account that can receive transfers';
  END IF;

  UPDATE public.host_payouts
  SET status = 'scheduled', recipient_code = v_recipient, failure_reason = NULL,
      transfer_reference = 'LKP_' || replace(gen_random_uuid()::text, '-', ''),
      paystack_transfer_code = NULL, processing_started_at = NULL, updated_at = now()
  WHERE id = p_payout_id AND status IN ('failed', 'needs_review');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only failed or reviewed payouts can be retried';
  END IF;
  PERFORM public.admin_audit('retry_payout', 'host_payout', p_payout_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_refund(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_payouts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_retry_payout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_retry_refund(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payouts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_payout(uuid) TO authenticated;

-- Admin list of payments now also shows refund progress.
DROP FUNCTION IF EXISTS public.admin_list_payments(text);
CREATE FUNCTION public.admin_list_payments(p_status text DEFAULT 'requires_refund')
RETURNS TABLE (
  id uuid, created_at timestamptz, paid_at timestamptz, reference text, payment_type text,
  status text, amount numeric, currency text, platform_fee numeric, host_amount numeric,
  hangout_id uuid, hangout_title text, hangout_status text, payer_name text, payer_email text,
  host_name text, refund_reason text, admin_note text,
  refund_amount numeric, refund_status text, refund_last_error text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  RETURN QUERY
  SELECT p.id, p.created_at, p.paid_at, p.reference, p.payment_type, p.status,
         p.amount, p.currency, p.platform_fee, p.host_amount,
         p.hangout_id, h.title, h.status,
         payer.name, p.metadata->>'user_email', host.name,
         coalesce(p.refund_reason, p.metadata->>'refund_reason'), p.admin_note,
         p.refund_amount, p.refund_status, p.refund_last_error
  FROM public.payments p
  LEFT JOIN public.hangouts h ON h.id = p.hangout_id
  LEFT JOIN public.profiles payer ON payer.id = p.user_id
  LEFT JOIN public.profiles host ON host.id = coalesce(p.host_id, h.host_id)
  WHERE p_status IS NULL OR p.status = p_status
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_payments(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_payments(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Payment-event minimisation also keeps refund/transfer identifiers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.minimize_paystack_payload(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'object' THEN coalesce(p, '{}'::jsonb)
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'event', p->'event',
      'minimized', true,
      'data', CASE WHEN jsonb_typeof(p->'data') = 'object' THEN jsonb_strip_nulls(jsonb_build_object(
        'id', p->'data'->'id',
        'domain', p->'data'->'domain',
        'status', p->'data'->'status',
        'reference', p->'data'->'reference',
        'transaction_reference', p->'data'->'transaction_reference',
        'refund_reference', p->'data'->'refund_reference',
        'transfer_code', p->'data'->'transfer_code',
        'amount', p->'data'->'amount',
        'requested_amount', p->'data'->'requested_amount',
        'currency', p->'data'->'currency',
        'paid_at', p->'data'->'paid_at',
        'created_at', p->'data'->'created_at',
        'channel', p->'data'->'channel',
        'gateway_response', p->'data'->'gateway_response',
        'fees', p->'data'->'fees',
        'fees_split', p->'data'->'fees_split',
        'metadata', CASE WHEN jsonb_typeof(p->'data'->'metadata') = 'object' THEN jsonb_strip_nulls(jsonb_build_object(
            'user_id', p->'data'->'metadata'->'user_id',
            'hangout_id', p->'data'->'metadata'->'hangout_id',
            'payment_type', p->'data'->'metadata'->'payment_type')) END,
        'subaccount_code', p->'data'->'subaccount'->'subaccount_code'
      )) END
    ))
  END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Completing a refund (service role: refund.processed webhook / jobs)
-- ---------------------------------------------------------------------------
-- Marks the payment refunded and removes what it paid for. Also covers
-- refunds issued manually from the Paystack dashboard. Idempotent.
CREATE OR REPLACE FUNCTION public.complete_payment_refund(p_reference text, p_amount numeric DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pay public.payments;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF pay.status = 'refunded' THEN
    RETURN 'already_refunded';
  END IF;
  IF pay.status NOT IN ('successful', 'requires_refund', 'flagged_mismatch') THEN
    RETURN 'ignored_status_' || pay.status;
  END IF;

  UPDATE public.payments
  SET status = 'refunded',
      refund_amount = coalesce(refund_amount, least(coalesce(p_amount, amount), amount)),
      refund_status = 'processed',
      refunded_at = now(),
      updated_at = now()
  WHERE id = pay.id;

  IF pay.payment_type = 'ticket' THEN
    DELETE FROM public.hangout_attendees a
    USING public.hangouts h
    WHERE a.hangout_id = pay.hangout_id AND a.user_id = pay.user_id
      AND h.id = a.hangout_id AND h.host_id <> pay.user_id;
  ELSIF pay.payment_type = 'sponsorship' THEN
    UPDATE public.hangout_sponsorships SET status = 'refunded', updated_at = now()
    WHERE payment_id = pay.id;
  END IF;

  RETURN 'refunded';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_payment_refund(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_refund(text, numeric) TO service_role;
