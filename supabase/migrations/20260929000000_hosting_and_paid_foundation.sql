-- Migration: LEENKIT Phase 1 - Hosting Guidelines & Paid Hangout Foundation

-- 1. Add Hosting Guidelines columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hosting_guidelines_accepted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hosting_guidelines_version text DEFAULT NULL;

-- 2. Create Secure RPC function for accepting Hosting Guidelines
CREATE OR REPLACE FUNCTION public.accept_hosting_guidelines(p_version text DEFAULT '1.0')
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated_profile public.profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept hosting guidelines';
  END IF;

  IF p_version IS NULL OR trim(p_version) = '' THEN
    p_version := '1.0';
  END IF;

  UPDATE public.profiles
  SET
    hosting_guidelines_accepted_at = now(),
    hosting_guidelines_version = trim(p_version),
    updated_at = now()
  WHERE id = v_user_id
  RETURNING * INTO v_updated_profile;

  RETURN v_updated_profile;
END;
$$;

-- Grant EXECUTE on RPC function to authenticated users only
REVOKE ALL ON FUNCTION public.accept_hosting_guidelines(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_hosting_guidelines(text) TO authenticated;

-- 3. Add Paid Hangout columns & check constraint to public.hangouts
ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN';

-- Add database check constraint for Free vs Paid price validity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hangouts_paid_chk'
  ) THEN
    ALTER TABLE public.hangouts
      ADD CONSTRAINT hangouts_paid_chk CHECK (
        (is_paid = false AND price IS NULL) OR
        (is_paid = true AND price IS NOT NULL AND price > 0)
      );
  END IF;
END $$;

-- 4. Update hangouts_insert_own RLS policy to enforce Hosting Guidelines acceptance
DROP POLICY IF EXISTS "hangouts_insert_own" ON public.hangouts;
CREATE POLICY "hangouts_insert_own"
  ON public.hangouts FOR INSERT
  TO authenticated
  WITH CHECK (
    host_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.hosting_guidelines_accepted_at IS NOT NULL
        AND p.hosting_guidelines_version = '1.0'
    )
  );
