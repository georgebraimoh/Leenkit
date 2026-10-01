-- Migration: 20261001000000_legal_acceptances.sql
-- Description: Durable, append-only record of each user's acceptance of the
-- LEENKIT Terms & Conditions and Privacy Policy.
--
-- Design notes
-- - Separate table (not profiles columns): public.profiles is readable by anon
--   and authenticated, so acceptance history there would be public.
-- - Users can only READ their own rows. There are no INSERT/UPDATE/DELETE
--   grants; the only write path is record_legal_acceptance(), which always
--   writes for auth.uid() and only for the currently supported versions.
-- - Append-only: an existing (user, terms_version, privacy_version) record is
--   never overwritten, so the original acceptance timestamp is preserved.
--   Introducing new document versions = new migration updating the allowed
--   versions in record_legal_acceptance() + new frontend constants
--   (src/data/legal.js). Users are then asked to accept again; older rows
--   remain as history.
-- - No existing rows are created or modified. Existing users have no record
--   and will be asked to accept in-app on their next visit.
-- - Does not touch profiles, the auth trigger, RLS on other tables, Paystack
--   objects or Edge Functions.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  source text NOT NULL CHECK (source IN ('signup', 'in_app')),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_acceptances_user_versions_key
    UNIQUE (user_id, terms_version, privacy_version)
);

-- No separate user_id index: legal_acceptances_user_versions_key is a btree
-- whose leading column is user_id, so it already serves user_id lookups.

-- ---------------------------------------------------------------------------
-- 2. RLS + privileges: owner read-only, no direct writes
-- ---------------------------------------------------------------------------
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legal_acceptances_select_own" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_own"
  ON public.legal_acceptances FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.legal_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.legal_acceptances TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. record_legal_acceptance(): the only write path
--    SECURITY DEFINER because authenticated has no INSERT privilege on the
--    table. Safe because: user_id is always auth.uid() (never a parameter),
--    versions must match the currently published versions, search_path is
--    pinned, and existing rows are never updated.
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
  c_terms_version   CONSTANT text := '2026-10-01';
  c_privacy_version CONSTANT text := '2026-10-01';
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
