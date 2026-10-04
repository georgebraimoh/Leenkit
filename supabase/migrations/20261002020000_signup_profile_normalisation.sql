-- Migration: 20261002020000_signup_profile_normalisation.sql
-- Description: handle_new_user() never fails a signup because of optional
-- profile metadata.
--
-- Problem: 20261002000000 added CHECK constraints (name <= 80 chars, avatar
-- must be https://). handle_new_user() copied auth metadata straight into
-- profiles, so a Google display name over 80 characters, or a non-https
-- avatar URL, aborted the whole auth.users INSERT ("Database error saving
-- new user") and the person could not sign up.
--
-- Fix (same function as 20261001000100, plus normalisation):
-- - Display name: whitespace collapsed, truncated to 80 characters.
-- - Avatar: kept only if it is an https:// URL of at most 2048 characters;
--   otherwise NULL (the app shows initials).
-- - Username logic, collision handling and idempotency are unchanged.
-- Existing profiles are not touched. Trigger on_auth_user_created is unchanged.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_name text;
  raw_avatar text;
  base_username text;
  candidate text;
  attempt integer := 0;
  default_bio CONSTANT text := 'Joined LEENKIT to discover fun activities around the world!';
BEGIN
  raw_name := coalesce(
    nullif(trim(NEW.raw_user_meta_data->>'name'), ''),
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(NEW.email, ''), '@', 1), ''),
    'LEENKIT User'
  );
  -- Collapse internal whitespace and fit profiles_text_len_chk (<= 80).
  raw_name := left(regexp_replace(raw_name, '\s+', ' ', 'g'), 80);
  raw_name := coalesce(nullif(trim(raw_name), ''), 'LEENKIT User');

  raw_avatar := coalesce(
    NEW.raw_user_meta_data->>'avatar',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );
  -- Only persist https URLs (profiles_avatar_chk); anything else is dropped.
  IF raw_avatar IS NULL
     OR raw_avatar !~* '^https://'
     OR char_length(raw_avatar) > 2048 THEN
    raw_avatar := NULL;
  END IF;

  base_username := left(
    btrim(
      regexp_replace(
        lower(coalesce(nullif(trim(NEW.raw_user_meta_data->>'username'), ''), raw_name)),
        '[^a-z0-9]+', '_', 'g'
      ),
      '_'
    ),
    24
  );
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'member';
  END IF;

  candidate := base_username;

  LOOP
    attempt := attempt + 1;

    INSERT INTO public.profiles (id, name, username, avatar, bio)
    VALUES (NEW.id, raw_name, candidate, raw_avatar, default_bio)
    ON CONFLICT DO NOTHING;

    IF FOUND THEN
      RETURN NEW;
    END IF;

    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      RETURN NEW;
    END IF;

    EXIT WHEN attempt >= 8;

    candidate := base_username || '_' ||
      substr(md5(random()::text || clock_timestamp()::text || NEW.id::text), 1,
             CASE WHEN attempt < 4 THEN 4 ELSE 8 END);
  END LOOP;

  INSERT INTO public.profiles (id, name, username, avatar, bio)
  VALUES (NEW.id, raw_name, 'user_' || replace(NEW.id::text, '-', ''), raw_avatar, default_bio)
  ON CONFLICT DO NOTHING;

  IF FOUND OR EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, name, username, avatar, bio)
  VALUES (NEW.id, raw_name, NULL, raw_avatar, default_bio)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
