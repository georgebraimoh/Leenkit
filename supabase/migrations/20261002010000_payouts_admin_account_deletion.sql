-- Migration: 20261002010000_payouts_admin_account_deletion.sql
-- Description:
--   1. Admin role + moderation tools (reports, suspensions, cancelling Hangouts,
--      refunds and payouts overview).
--   2. Host payouts through Paystack split payments: payout accounts, platform
--      fee recorded on every payment, host earnings summary.
--   3. Account deletion support (anonymise when payment records must be kept).
--   4. Terms & Privacy version bump to 2026-10-02 (platform fee, payouts,
--      account deletion). Signed-in users are asked to accept again.
--
-- Platform fee: 10% of each ticket and sponsorship, minimum NGN 200. LEENKIT
-- pays the Paystack processing fees (bearer = account). Change the numbers in
-- public.platform_settings; the Edge Functions read them from there.

-- ---------------------------------------------------------------------------
-- 0. Settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
CREATE POLICY "platform_settings_read"
  ON public.platform_settings FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON TABLE public.platform_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.platform_settings TO anon, authenticated;

INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_fee', '{"percent": 10, "min_ngn": 200, "min_payment_ngn": 1000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. Profile flags: admin, suspension, deletion
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- None of these columns are in the authenticated UPDATE grant, so clients
-- cannot change them. Admin changes go through the functions below.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_suspended(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user AND (suspended_at IS NOT NULL OR deleted_at IS NOT NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

-- First admin: the product owner's account (no-op if that email has no account).
UPDATE public.profiles p
SET is_admin = true
FROM auth.users u
WHERE u.id = p.id AND lower(u.email) = 'georgebraimoh@gmail.com';

-- Suspended or deleted accounts cannot host, join or post.
DROP POLICY IF EXISTS "hangouts_insert_own" ON public.hangouts;
CREATE POLICY "hangouts_insert_own"
  ON public.hangouts FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND NOT public.is_suspended(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.hosting_guidelines_accepted_at IS NOT NULL
        AND p.hosting_guidelines_version = '1.0'
    )
  );

DROP POLICY IF EXISTS "hangout_attendees_insert_own" ON public.hangout_attendees;
CREATE POLICY "hangout_attendees_insert_own"
  ON public.hangout_attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_suspended(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.hangouts h
      WHERE h.id = hangout_id
        AND (h.is_paid IS FALSE OR h.is_paid IS NULL)
        AND h.status = 'upcoming'
    )
  );

DROP POLICY IF EXISTS "hangout_messages_insert_members" ON public.hangout_messages;
CREATE POLICY "hangout_messages_insert_members"
  ON public.hangout_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_suspended(auth.uid())
    AND public.is_hangout_member(hangout_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. Safety reports: admin review fields + admin functions
-- ---------------------------------------------------------------------------
ALTER TABLE public.safety_reports
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  status text,
  target_type text,
  target_id uuid,
  target_label text,
  target_username text,
  reason text,
  description text,
  admin_note text,
  reviewed_at timestamptz,
  reporter_id uuid,
  reporter_name text,
  reporter_username text,
  reports_on_target bigint
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
  SELECT
    r.id, r.created_at, r.status, r.target_type, r.target_id,
    CASE
      WHEN r.target_type IN ('activity', 'space') THEN coalesce(h.title, 'Deleted Hangout')
      ELSE coalesce(tp.name, 'Deleted member')
    END AS target_label,
    CASE WHEN r.target_type = 'user' THEN tp.username ELSE NULL END AS target_username,
    r.reason, r.description, r.admin_note, r.reviewed_at,
    r.reporter_id, rp.name, rp.username,
    (SELECT count(*) FROM public.safety_reports r2 WHERE r2.target_id = r.target_id) AS reports_on_target
  FROM public.safety_reports r
  LEFT JOIN public.hangouts h ON r.target_type IN ('activity', 'space') AND h.id = r.target_id
  LEFT JOIN public.profiles tp ON r.target_type = 'user' AND tp.id = r.target_id
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_report(p_report_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF p_status NOT IN ('pending', 'reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Unsupported report status';
  END IF;

  UPDATE public.safety_reports
  SET status = p_status,
      admin_note = coalesce(nullif(trim(p_note), ''), admin_note),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_suspension(p_user_id uuid, p_suspend boolean, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  -- A suspended host's upcoming Hangouts are cancelled.
  IF p_suspend THEN
    UPDATE public.hangouts
    SET status = 'cancelled'
    WHERE host_id = p_user_id AND status = 'upcoming';
  END IF;
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
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Host payouts (Paystack subaccounts) + fee on every payment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.host_payout_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN')),
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_last4 text NOT NULL CHECK (char_length(account_last4) = 4),
  paystack_subaccount_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.host_payout_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "host_payout_accounts_select_own" ON public.host_payout_accounts;
CREATE POLICY "host_payout_accounts_select_own"
  ON public.host_payout_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- Written only by the payout-account Edge Function (service role).
REVOKE ALL ON TABLE public.host_payout_accounts FROM anon, authenticated;
GRANT SELECT ON TABLE public.host_payout_accounts TO authenticated;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES public.profiles (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS platform_fee numeric(12, 2),
  ADD COLUMN IF NOT EXISTS host_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_note text;

-- Paid Hangouts need a payout account, NGN pricing and a minimum price.
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

  IF NOT EXISTS (SELECT 1 FROM public.host_payout_accounts WHERE user_id = NEW.host_id) THEN
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

REVOKE ALL ON FUNCTION public.check_paid_hangout_rules() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_paid_rules ON public.hangouts;
CREATE TRIGGER hangouts_paid_rules
  BEFORE INSERT OR UPDATE ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.check_paid_hangout_rules();

-- Cancelling a Hangout flags its paid tickets for refund.
CREATE OR REPLACE FUNCTION public.flag_refunds_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.payments
  SET status = 'requires_refund',
      metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"hangout_cancelled"}'::jsonb,
      updated_at = now()
  WHERE hangout_id = NEW.id
    AND payment_type = 'ticket'
    AND status = 'successful';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.flag_refunds_on_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_flag_refunds_on_cancel ON public.hangouts;
CREATE TRIGGER hangouts_flag_refunds_on_cancel
  AFTER UPDATE OF status ON public.hangouts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
  EXECUTE PROCEDURE public.flag_refunds_on_cancel();

-- What a host has earned (after the platform fee).
CREATE OR REPLACE FUNCTION public.get_host_earnings()
RETURNS TABLE (
  currency text,
  tickets_sold bigint,
  sponsorships bigint,
  gross numeric,
  platform_fees numeric,
  host_earnings numeric,
  pending_refunds bigint
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
    count(*) FILTER (WHERE p.status = 'requires_refund')
  FROM public.payments p
  WHERE p.host_id = auth.uid()
    AND p.host_amount IS NOT NULL
  GROUP BY p.currency;
$$;

REVOKE ALL ON FUNCTION public.get_host_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_host_earnings() TO authenticated;

-- Admin: payments needing action, and marking refunds done.
CREATE OR REPLACE FUNCTION public.admin_list_payments(p_status text DEFAULT 'requires_refund')
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  paid_at timestamptz,
  reference text,
  payment_type text,
  status text,
  amount numeric,
  currency text,
  platform_fee numeric,
  host_amount numeric,
  hangout_id uuid,
  hangout_title text,
  hangout_status text,
  payer_name text,
  payer_email text,
  host_name text,
  refund_reason text,
  admin_note text
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
         p.metadata->>'refund_reason', p.admin_note
  FROM public.payments p
  LEFT JOIN public.hangouts h ON h.id = p.hangout_id
  LEFT JOIN public.profiles payer ON payer.id = p.user_id
  LEFT JOIN public.profiles host ON host.id = coalesce(p.host_id, h.host_id)
  WHERE p_status IS NULL OR p.status = p_status
  ORDER BY p.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_refunded(p_payment_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pay public.payments;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
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
      admin_note = coalesce(nullif(trim(p_note), ''), admin_note)
  WHERE id = p_payment_id;

  -- A refunded ticket no longer holds a spot.
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
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS TABLE (
  pending_reports bigint,
  refunds_due bigint,
  suspended_users bigint,
  payout_accounts bigint,
  fees_collected_ngn numeric
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

  RETURN QUERY SELECT
    (SELECT count(*) FROM public.safety_reports WHERE status IN ('pending', 'reviewing')),
    (SELECT count(*) FROM public.payments WHERE status = 'requires_refund'),
    (SELECT count(*) FROM public.profiles WHERE suspended_at IS NOT NULL),
    (SELECT count(*) FROM public.host_payout_accounts),
    (SELECT coalesce(sum(platform_fee), 0) FROM public.payments WHERE status = 'successful' AND currency = 'NGN');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_report(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_suspension(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_hangout(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_payments(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_refunded(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_report(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_hangout(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_payments(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_refunded(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Account deletion (called by the delete-account Edge Function)
-- ---------------------------------------------------------------------------
-- Cleans up everything the user owns and reports whether payment records
-- tie the account to financial history (then it is anonymised, not erased).
CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_payments boolean;
  v_cancelled int;
BEGIN
  -- Cancel upcoming Hangouts they host (attendees are notified; paid tickets
  -- are flagged for refund by the cancel triggers).
  UPDATE public.hangouts SET status = 'cancelled'
  WHERE host_id = p_user_id AND status = 'upcoming';
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  -- Leave Hangouts they were going to (not ones they host).
  DELETE FROM public.hangout_attendees a
  USING public.hangouts h
  WHERE a.user_id = p_user_id AND h.id = a.hangout_id AND h.host_id <> p_user_id;

  DELETE FROM public.follows WHERE follower_id = p_user_id OR following_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM public.host_payout_accounts WHERE user_id = p_user_id;

  v_has_payments := EXISTS (SELECT 1 FROM public.payments WHERE user_id = p_user_id OR host_id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.payments p JOIN public.hangouts h ON h.id = p.hangout_id
      WHERE h.host_id = p_user_id
    );

  IF v_has_payments THEN
    -- Keep the row (payments reference it) but remove everything personal.
    UPDATE public.profiles
    SET name = 'Deleted member',
        username = NULL,
        avatar = NULL,
        bio = '',
        location = '',
        interests = '[]'::jsonb,
        instagram_url = NULL,
        tiktok_url = NULL,
        spotify_url = NULL,
        is_admin = false,
        deleted_at = now()
    WHERE id = p_user_id;

    UPDATE public.hangout_messages
    SET user_name = 'Deleted member', user_avatar = NULL
    WHERE user_id = p_user_id;

    DELETE FROM public.hangout_messages WHERE user_id = p_user_id AND type = 'user';

    UPDATE public.payments
    SET metadata = coalesce(metadata, '{}'::jsonb) - 'user_email' || '{"account_deleted":true}'::jsonb
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('has_payments', v_has_payments, 'cancelled_hangouts', v_cancelled);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) TO service_role;

-- Deleted members show as such; their profile is hidden from lookups by username.
CREATE OR REPLACE FUNCTION public.hide_deleted_profiles_username()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.username := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_hide_deleted_username ON public.profiles;
CREATE TRIGGER profiles_hide_deleted_username
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.hide_deleted_profiles_username();

-- ---------------------------------------------------------------------------
-- 5. Terms & Privacy 2026-10-02 (platform fee, payouts, deletion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
RETURNS public.legal_acceptances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Keep in sync with src/data/legal.js
  c_terms_version   CONSTANT text := '2026-10-02';
  c_privacy_version CONSTANT text := '2026-10-02';
  v_user_id uuid;
  v_row public.legal_acceptances;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept the Terms and Privacy Policy';
  END IF;

  IF p_terms_version IS DISTINCT FROM c_terms_version
     OR p_privacy_version IS DISTINCT FROM c_privacy_version THEN
    RAISE EXCEPTION 'Unsupported Terms or Privacy Policy version';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('signup', 'in_app') THEN
    RAISE EXCEPTION 'Unsupported acceptance source';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version, source)
  VALUES (v_user_id, c_terms_version, c_privacy_version, p_source)
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  SELECT * INTO v_row
  FROM public.legal_acceptances
  WHERE user_id = v_user_id
    AND terms_version = c_terms_version
    AND privacy_version = c_privacy_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acceptance could not be recorded';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_legal_acceptance(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(text, text, text) TO authenticated;
