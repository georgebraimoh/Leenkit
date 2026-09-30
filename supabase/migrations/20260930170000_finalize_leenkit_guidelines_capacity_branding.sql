-- Capture production LEENKIT database fixes applied directly in the dashboard.
-- Idempotent CREATE OR REPLACE / DROP CONSTRAINT IF EXISTS / GRANT only.
-- Does not alter RLS policies, Paystack objects, Edge Functions, the auth
-- trigger, or existing profile rows.

-- ---------------------------------------------------------------------------
-- 1. Hangout capacity: 2–10000
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_max_attendees_check;

ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_max_attendees_check
  CHECK (max_attendees >= 2 AND max_attendees <= 10000);

-- ---------------------------------------------------------------------------
-- 2. handle_new_user(): LEENKIT default bio for NEW accounts only
--    ON CONFLICT DO NOTHING — existing profiles are not overwritten.
--    Trigger on_auth_user_created is left in place.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ---------------------------------------------------------------------------
-- 3. Column-level UPDATE so SECURITY INVOKER accept_hosting_guidelines can
--    write these two fields. Do not grant UPDATE on the whole table.
-- ---------------------------------------------------------------------------
GRANT UPDATE (
  hosting_guidelines_accepted_at,
  hosting_guidelines_version
) ON public.profiles TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. accept_hosting_guidelines(): production signature RETURNS void
--    SECURITY INVOKER, version 1.0 only, own profile only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_hosting_guidelines(p_version text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
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
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_hosting_guidelines(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_hosting_guidelines(text) TO authenticated;
