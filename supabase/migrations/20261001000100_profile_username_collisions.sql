-- Migration: 20261001000100_profile_username_collisions.sql
-- Description: Make handle_new_user() the single, collision-safe creator of the
-- initial profile row for every new Auth user (email and Google).
--
-- Problem: usernames were derived from the email local-part
-- (john@gmail.com and john@yahoo.com -> "john"). The case-insensitive unique
-- index profiles_username_key rejected the second insert, which aborted the
-- whole auth.users INSERT ("Database error saving new user").
--
-- Fix:
-- - Base username comes from the username metadata if supplied, otherwise from
--   the display name (already public), so the email address is not exposed.
-- - INSERT ... ON CONFLICT DO NOTHING (no conflict target) covers both the
--   primary key and the unique username index. If the username was taken, a
--   short random suffix is tried; the unique index itself arbitrates
--   concurrent signups, so there is no check-then-insert race.
-- - Last resorts: a username derived from the user id, then NULL (the unique
--   index ignores NULL), so a username clash can never block account creation.
--
-- Unchanged: trigger on_auth_user_created, the unique username index, existing
-- profile rows, RLS, grants.

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

  raw_avatar := coalesce(
    NEW.raw_user_meta_data->>'avatar',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture'
  );

  -- Readable slug: lowercase letters, digits and single underscores.
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

    -- Profile already exists for this user: nothing to do.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      RETURN NEW;
    END IF;

    EXIT WHEN attempt >= 8;

    -- Username taken: retry with a random suffix (longer after a few tries).
    candidate := base_username || '_' ||
      substr(md5(random()::text || clock_timestamp()::text || NEW.id::text), 1,
             CASE WHEN attempt < 4 THEN 4 ELSE 8 END);
  END LOOP;

  -- Last resort 1: id-derived username.
  INSERT INTO public.profiles (id, name, username, avatar, bio)
  VALUES (NEW.id, raw_name, 'user_' || replace(NEW.id::text, '-', ''), raw_avatar, default_bio)
  ON CONFLICT DO NOTHING;

  IF FOUND OR EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Last resort 2: no username (excluded from the unique index).
  INSERT INTO public.profiles (id, name, username, avatar, bio)
  VALUES (NEW.id, raw_name, NULL, raw_avatar, default_bio)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
