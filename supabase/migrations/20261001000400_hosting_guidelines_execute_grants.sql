-- Migration: 20261001000400_hosting_guidelines_execute_grants.sql
-- Description: Least-privilege EXECUTE on accept_hosting_guidelines(text).
-- Supabase's default privileges grant EXECUTE on new public functions to anon
-- directly, so the earlier "REVOKE ALL ... FROM PUBLIC" left anon able to call
-- it. The function already rejects anon (auth.uid() IS NULL); this removes the
-- grant as defence in depth. Function body, signature and the authenticated
-- grant are unchanged.

REVOKE ALL ON FUNCTION public.accept_hosting_guidelines(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_hosting_guidelines(text) TO authenticated;
