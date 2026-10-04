-- Migration: 20261004020000_paid_hangouts_switch.sql
-- Description: Master switch for paid features (owner decision 2026-10-04:
-- launch with free Hangouts only until the Paystack account is upgraded to a
-- Registered Business, which is required for Transfers/host payouts).
--
-- platform_settings.payments.paid_hangouts_enabled (default FALSE here):
--   * the database rejects creating a paid Hangout or turning a Hangout paid
--     (check_paid_hangout_rules), whatever client is used;
--   * initialize-paystack-transaction and payout-account refuse requests;
--   * the app hides paid tickets, online sponsorships and payouts.
-- Pledges (no money) stay available. Existing Hangouts are not modified.
--
-- To turn paid Hangouts on later (after the Paystack upgrade):
--   update public.platform_settings
--   set value = jsonb_set(value, '{paid_hangouts_enabled}', 'true')
--   where key = 'payments';

UPDATE public.platform_settings
SET value = value || '{"paid_hangouts_enabled": false}'::jsonb, updated_at = now()
WHERE key = 'payments' AND NOT (value ? 'paid_hangouts_enabled');

-- Same as 20261004000000, plus the master switch.
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

  IF NOT coalesce((public.payment_setting('paid_hangouts_enabled') #>> '{}')::boolean, false) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_PAID_HANGOUTS_DISABLED';
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
