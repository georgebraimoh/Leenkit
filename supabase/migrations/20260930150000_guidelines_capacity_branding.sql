-- LEENKIT: fix hosting guidelines accept under SECURITY INVOKER,
-- raise hangout capacity upper bound, and update new-account default bio.
-- Additive / replace-function only. Does not rewrite prior migrations.

-- ---------------------------------------------------------------------------
-- 1. Allow authenticated users to update hosting-guidelines columns on their
--    own profile row (RLS profiles_update_own still restricts to auth.uid()).
--    accept_hosting_guidelines is SECURITY INVOKER, so it needs these grants.
-- ---------------------------------------------------------------------------
GRANT UPDATE (
  hosting_guidelines_accepted_at,
  hosting_guidelines_version
) ON TABLE public.profiles TO authenticated;

-- Align RPC with production security model: INVOKER, version 1.0 only.
-- Do not use SECURITY DEFINER. Trigger set_updated_at still stamps updated_at.
CREATE OR REPLACE FUNCTION public.accept_hosting_guidelines(p_version text DEFAULT '1.0')
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated_profile public.profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept hosting guidelines';
  END IF;

  IF p_version IS NULL OR trim(p_version) <> '1.0' THEN
    RAISE EXCEPTION 'Unsupported hosting guidelines version';
  END IF;

  UPDATE public.profiles
  SET
    hosting_guidelines_accepted_at = now(),
    hosting_guidelines_version = '1.0'
  WHERE id = v_user_id
  RETURNING * INTO v_updated_profile;

  IF v_updated_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_hosting_guidelines(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_hosting_guidelines(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Hangout capacity: 2–10000. Keep enforce_hangout_capacity trigger as-is.
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_max_attendees_check;
ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_max_attendees_chk;

ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_max_attendees_check
  CHECK (max_attendees >= 2 AND max_attendees <= 10000);

-- ---------------------------------------------------------------------------
-- 3. New-account default bio (handle_new_user). Existing rows are unchanged.
--    SECURITY DEFINER is required: this trigger inserts into public.profiles
--    from auth.users, which the new user cannot do as invoker.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  raw_name text;
  raw_username text;
  raw_avatar text;
BEGIN
  raw_name := coalesce(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'LEENKIT User'
  );

  raw_username := coalesce(
    NEW.raw_user_meta_data->>'username',
    regexp_replace(lower(split_part(coalesce(NEW.email, ''), '@', 1)), '[^a-z0-9]', '_', 'g'),
    'user_' || substr(NEW.id::text, 1, 8)
  );

  raw_avatar := coalesce(
    NEW.raw_user_meta_data->>'avatar',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  INSERT INTO public.profiles (id, name, username, avatar, bio)
  VALUES (
    NEW.id,
    raw_name,
    raw_username,
    raw_avatar,
    'Joined LEENKIT to discover fun activities around the world!'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
