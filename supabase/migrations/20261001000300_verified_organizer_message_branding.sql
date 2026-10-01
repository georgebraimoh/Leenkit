-- Migration: 20261001000300_verified_organizer_message_branding.sql
-- Description: Replace the user-facing "Qleenq" wording in the
-- protect_verified_organizer() error message with LEENKIT.
-- Logic is unchanged from 20260918140000_backend_v1.sql: only the
-- service_role may change is_verified_organizer / organizer_verified_at.
-- Same signature and return type (trigger), so CREATE OR REPLACE is valid;
-- the existing protect_verified_organizer trigger keeps using it.

CREATE OR REPLACE FUNCTION public.protect_verified_organizer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_verified_organizer IS DISTINCT FROM OLD.is_verified_organizer
     OR NEW.organizer_verified_at IS DISTINCT FROM OLD.organizer_verified_at THEN
    IF coalesce(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Verified organizer status can only be changed by LEENKIT';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
