-- Migration: 20261002030000_abuse_audit_payments_hardening.sql
-- Description: Forward-only hardening on top of 20261002000000 /
-- 20261002010000 (this branch). No existing rows are modified.
--
--  1. Abuse controls: database-side rate limits for safety reports, Hangout
--     Space messages and sponsorship pledges (cannot be bypassed by calling
--     the API directly). Limits are conservative defaults; tune here.
--  2. Storage: public buckets keep serving images by public URL, but anyone
--     could LIST every uploaded file through the API. Listing/reading through
--     the API is now limited to the owner's own folder.
--  3. Admin audit log: every admin action is recorded (who, what, when).
--     admin_mark_refunded() now requires the Paystack refund reference, so a
--     payment is only shown as refunded once a real refund exists.
--  4. settle_payment(): a sponsorship paid for a Hangout that is no longer
--     open is flagged requires_refund instead of being recorded as paid
--     (tickets already behaved this way).
--  5. Payment-event minimisation: Paystack webhook payloads are reduced to
--     the fields needed for reconciliation (no customer email, card or IP
--     details) before they are stored. A service-role-only function can
--     minimise historical rows; it is NOT run automatically.

-- ---------------------------------------------------------------------------
-- 1. Rate limits
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.raise_rate_limited(p_what text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_RATE_LIMITED',
    DETAIL = p_what;
END;
$$;

REVOKE ALL ON FUNCTION public.raise_rate_limited(text) FROM PUBLIC, anon, authenticated;

-- Safety reports: 10 per hour per reporter, 3 per target per 24 hours.
CREATE OR REPLACE FUNCTION public.safety_reports_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF (SELECT count(*) FROM public.safety_reports
      WHERE reporter_id = v_uid AND created_at > now() - interval '1 hour') >= 10 THEN
    PERFORM public.raise_rate_limited('safety_reports_per_hour');
  END IF;

  IF (SELECT count(*) FROM public.safety_reports
      WHERE reporter_id = v_uid AND target_id = NEW.target_id
        AND created_at > now() - interval '24 hours') >= 3 THEN
    PERFORM public.raise_rate_limited('safety_reports_per_target');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.safety_reports_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS safety_reports_rate_limit ON public.safety_reports;
CREATE TRIGGER safety_reports_rate_limit
  BEFORE INSERT ON public.safety_reports
  FOR EACH ROW EXECUTE PROCEDURE public.safety_reports_rate_limit();

CREATE INDEX IF NOT EXISTS safety_reports_reporter_created_idx
  ON public.safety_reports (reporter_id, created_at DESC);

-- Hangout Space messages: 20 per minute per sender (system notices exempt).
CREATE OR REPLACE FUNCTION public.hangout_messages_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL
     OR coalesce(auth.role(), '') = 'service_role'
     OR coalesce(current_setting('leenkit.system_message', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF (SELECT count(*) FROM public.hangout_messages
      WHERE user_id = v_uid AND type = 'user'
        AND created_at > now() - interval '1 minute') >= 20 THEN
    PERFORM public.raise_rate_limited('hangout_messages_per_minute');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangout_messages_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangout_messages_rate_limit ON public.hangout_messages;
CREATE TRIGGER hangout_messages_rate_limit
  BEFORE INSERT ON public.hangout_messages
  FOR EACH ROW EXECUTE PROCEDURE public.hangout_messages_rate_limit();

CREATE INDEX IF NOT EXISTS hangout_messages_user_created_idx
  ON public.hangout_messages (user_id, created_at DESC);

-- Sponsorship pledges: 10 per hour per sponsor (paid sponsorships are
-- written by settle_payment as the service role and are exempt).
CREATE OR REPLACE FUNCTION public.hangout_sponsorships_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR coalesce(auth.role(), '') = 'service_role' OR NEW.status <> 'pledged' THEN
    RETURN NEW;
  END IF;

  IF (SELECT count(*) FROM public.hangout_sponsorships
      WHERE sponsor_id = v_uid AND status = 'pledged'
        AND created_at > now() - interval '1 hour') >= 10 THEN
    PERFORM public.raise_rate_limited('pledges_per_hour');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangout_sponsorships_rate_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangout_sponsorships_rate_limit ON public.hangout_sponsorships;
CREATE TRIGGER hangout_sponsorships_rate_limit
  BEFORE INSERT ON public.hangout_sponsorships
  FOR EACH ROW EXECUTE PROCEDURE public.hangout_sponsorships_rate_limit();

CREATE INDEX IF NOT EXISTS hangout_sponsorships_sponsor_created_idx
  ON public.hangout_sponsorships (sponsor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Storage: no public listing of uploaded files
-- ---------------------------------------------------------------------------
-- Public buckets serve objects by public URL without consulting these
-- policies, so images keep displaying. The API read/list path is limited to
-- the uploader's own folder (also needed for owners to delete their files).
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_select_own_folder" ON storage.objects;
CREATE POLICY "profile_images_select_own_folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-images' AND split_part(name, '/', 1) = auth.uid()::text);

DROP POLICY IF EXISTS "hangout_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "hangout_images_select_own_folder" ON storage.objects;
CREATE POLICY "hangout_images_select_own_folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'hangout-images' AND split_part(name, '/', 1) = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 3. Admin audit log + audited admin actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx ON public.admin_audit_log (target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies and no grants: only SECURITY DEFINER functions and the
-- service role (dashboard) can read or write it. Append-only by design.
REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_audit(p_action text, p_target_type text, p_target_id uuid, p_details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

REVOKE ALL ON FUNCTION public.admin_audit(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit integer DEFAULT 200)
RETURNS SETOF public.admin_audit_log
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
  SELECT * FROM public.admin_audit_log
  ORDER BY created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(integer) TO authenticated;

-- Same signatures and behaviour as 20261002010000, plus auditing.
CREATE OR REPLACE FUNCTION public.admin_update_report(p_report_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('pending', 'reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Unsupported report status';
  END IF;

  SELECT status INTO v_old FROM public.safety_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  UPDATE public.safety_reports
  SET status = p_status,
      admin_note = coalesce(nullif(trim(p_note), ''), admin_note),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_report_id;

  PERFORM public.admin_audit('report_status', 'safety_report', p_report_id,
    jsonb_build_object('from', v_old, 'to', p_status, 'note', nullif(trim(p_note), '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(p_user_id uuid, p_suspend boolean, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cancelled integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot suspend yourself';
  END IF;

  UPDATE public.profiles
  SET suspended_at = CASE WHEN p_suspend THEN now() ELSE NULL END,
      suspension_reason = CASE WHEN p_suspend THEN nullif(trim(p_reason), '') ELSE NULL END
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF p_suspend THEN
    UPDATE public.hangouts
    SET status = 'cancelled'
    WHERE host_id = p_user_id AND status = 'upcoming';
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  PERFORM public.admin_audit(CASE WHEN p_suspend THEN 'suspend' ELSE 'unsuspend' END, 'profile', p_user_id,
    jsonb_build_object('reason', nullif(trim(p_reason), ''), 'cancelled_hangouts', v_cancelled));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_hangout(p_hangout_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  UPDATE public.hangouts SET status = 'cancelled'
  WHERE id = p_hangout_id AND status = 'upcoming';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hangout not found or not upcoming';
  END IF;

  PERFORM public.admin_audit('cancel_hangout', 'hangout', p_hangout_id, '{}'::jsonb);
END;
$$;

-- p_note is now REQUIRED: the Paystack refund reference (or equivalent
-- evidence) for a refund that has actually been issued in Paystack.
CREATE OR REPLACE FUNCTION public.admin_mark_refunded(p_payment_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pay public.payments;
  v_ref text := nullif(trim(coalesce(p_note, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  IF v_ref IS NULL THEN
    RAISE EXCEPTION 'Enter the Paystack refund reference for a refund that has already been issued';
  END IF;

  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF pay.status NOT IN ('requires_refund', 'successful', 'flagged_mismatch') THEN
    RAISE EXCEPTION 'This payment cannot be marked refunded (status %)', pay.status;
  END IF;

  UPDATE public.payments
  SET status = 'refunded', refunded_at = now(), updated_at = now(),
      admin_note = left(v_ref, 500),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refund_reference', left(v_ref, 200))
  WHERE id = p_payment_id;

  IF pay.payment_type = 'ticket' THEN
    DELETE FROM public.hangout_attendees a
    USING public.hangouts h
    WHERE a.hangout_id = pay.hangout_id
      AND a.user_id = pay.user_id
      AND h.id = a.hangout_id
      AND h.host_id <> pay.user_id;
  ELSIF pay.payment_type = 'sponsorship' THEN
    UPDATE public.hangout_sponsorships SET status = 'refunded', updated_at = now()
    WHERE payment_id = pay.id;
  END IF;

  PERFORM public.admin_audit('mark_refunded', 'payment', p_payment_id,
    jsonb_build_object('previous_status', pay.status, 'refund_reference', left(v_ref, 200),
                       'amount', pay.amount, 'currency', pay.currency));
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. settle_payment(): closed Hangouts never record a paid sponsorship
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payment(
  p_reference text,
  p_amount_subunits bigint,
  p_currency text,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pay public.payments;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_open boolean;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE reference = p_reference FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Idempotent: anything already settled is returned as is.
  IF pay.status <> 'pending' THEN
    RETURN pay.status;
  END IF;

  IF p_amount_subunits IS DISTINCT FROM round(pay.amount * 100)::bigint
     OR upper(coalesce(p_currency, '')) <> upper(pay.currency) THEN
    UPDATE public.payments
    SET status = 'flagged_mismatch',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'mismatch', true, 'received_amount', p_amount_subunits, 'received_currency', p_currency),
        updated_at = now()
    WHERE id = pay.id;
    RETURN 'flagged_mismatch';
  END IF;

  IF pay.payment_type = 'ticket' THEN
    BEGIN
      INSERT INTO public.hangout_attendees (hangout_id, user_id)
      VALUES (pay.hangout_id, pay.user_id);
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.payments
        SET status = 'requires_refund', paid_at = v_paid_at, updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"already_attending"}'::jsonb
        WHERE id = pay.id;
        RETURN 'requires_refund';
      WHEN raise_exception THEN
        UPDATE public.payments
        SET status = 'requires_refund', paid_at = v_paid_at, updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refund_reason', SQLERRM)
        WHERE id = pay.id;
        RETURN 'requires_refund';
    END;
  ELSIF pay.payment_type = 'sponsorship' THEN
    SELECT (h.status = 'upcoming' AND (h.date IS NULL OR h.date >= current_date - 1))
    INTO v_open
    FROM public.hangouts h WHERE h.id = pay.hangout_id;

    IF NOT coalesce(v_open, false) THEN
      UPDATE public.payments
      SET status = 'requires_refund', paid_at = v_paid_at, updated_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"LEENKIT_HANGOUT_CLOSED"}'::jsonb
      WHERE id = pay.id;
      RETURN 'requires_refund';
    END IF;

    INSERT INTO public.hangout_sponsorships (hangout_id, sponsor_id, amount, currency, message, status, payment_id)
    VALUES (pay.hangout_id, pay.user_id, pay.amount, pay.currency, pay.metadata->>'message', 'paid', pay.id)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.payments
  SET status = 'successful', paid_at = v_paid_at, updated_at = now()
  WHERE id = pay.id;

  RETURN 'successful';
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payment(text, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment(text, bigint, text, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Payment-event minimisation
-- ---------------------------------------------------------------------------
-- Keeps what reconciliation and disputes need (ids, reference, amounts,
-- status, timing, channel, fees, LEENKIT metadata, subaccount code).
-- Drops customer (email/name/phone), authorization (card details), IP
-- address, device/log data and anything else not listed.
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

CREATE OR REPLACE FUNCTION public.payment_events_minimize()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.payload IS NOT NULL AND NOT coalesce((NEW.payload->>'minimized')::boolean, false) THEN
    NEW.payload := public.minimize_paystack_payload(NEW.payload);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_events_minimize() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payment_events_minimize ON public.payment_events;
CREATE TRIGGER payment_events_minimize
  BEFORE INSERT OR UPDATE OF payload ON public.payment_events
  FOR EACH ROW EXECUTE PROCEDURE public.payment_events_minimize();

-- Historical rows: minimise on request only (owner decision; not scheduled).
-- Returns the number of rows changed. Service role only.
CREATE OR REPLACE FUNCTION public.minimize_historical_payment_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.payment_events
  SET payload = public.minimize_paystack_payload(payload), updated_at = now()
  WHERE NOT coalesce((payload->>'minimized')::boolean, false);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.minimize_historical_payment_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.minimize_historical_payment_events() TO service_role;
