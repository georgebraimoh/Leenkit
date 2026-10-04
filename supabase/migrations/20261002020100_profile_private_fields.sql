-- Migration: 20261002020100_profile_private_fields.sql
-- Description: Stop exposing admin / moderation fields on public profiles.
--
-- Problem: public.profiles is readable by anon and authenticated
-- (profiles_select_public USING true) with a table-level SELECT grant, so the
-- columns added in 20261002010000 (is_admin, suspended_at, suspension_reason,
-- deleted_at) were readable by anyone, including signed-out visitors.
--
-- Fix:
-- - Replace the table-level SELECT grant with a column-level grant listing
--   only the public profile columns. New columns are private by default from
--   now on and must be added here deliberately to become readable.
-- - get_my_account_status(): the signed-in user can read their own admin /
--   suspension / deletion state (needed by the app); nobody else can.
-- - Least privilege: anon never writes profiles (RLS already blocked it;
--   the table-level INSERT/UPDATE/DELETE grants are removed as well).
--
-- Server-side code is unaffected: is_admin(), is_suspended(), the admin_*
-- functions and prepare_account_deletion() are SECURITY DEFINER, and Edge
-- Functions use the service role. The column UPDATE grants for
-- authenticated (profile editing) are unchanged.
--
-- Clients must select explicit columns: select('*') on profiles now fails
-- with "permission denied" because it would include the private columns.

REVOKE SELECT ON TABLE public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon;

GRANT SELECT (
  id,
  name,
  username,
  avatar,
  location,
  bio,
  interests,
  hosted_count,
  attended_count,
  is_organizer,
  is_verified_organizer,
  organizer_verified_at,
  followers_count,
  following_count,
  created_at,
  updated_at,
  instagram_url,
  tiktok_url,
  spotify_url,
  hosting_guidelines_accepted_at,
  hosting_guidelines_version
) ON TABLE public.profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_account_status()
RETURNS TABLE (
  is_admin boolean,
  suspended_at timestamptz,
  suspension_reason text,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.is_admin, p.suspended_at, p.suspension_reason, p.deleted_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_account_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_account_status() TO authenticated;
