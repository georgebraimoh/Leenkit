-- Migration: 20261001000200_safety_reports.sql
-- Description: Server-side storage for safety reports submitted from the
-- Report option on Hangouts, profiles and Hangout Spaces. Previously reports
-- were only written to the reporter's browser localStorage.
--
-- Security model
-- - Signed-in users can INSERT reports for themselves only. reporter_id
--   defaults to auth.uid() and is enforced by RLS; status/created_at/id cannot
--   be set by clients (column-level INSERT grant).
-- - No SELECT/UPDATE/DELETE for anon or authenticated: users cannot read,
--   change or delete any report, including their own. Reports are never public.
-- - Review/administration uses the service role (Supabase dashboard or a
--   future secure admin path), which bypasses RLS.
--
-- Does not touch profiles, hangouts, payments, Paystack objects, storage,
-- realtime, or any existing policy.

CREATE TABLE IF NOT EXISTS public.safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('activity', 'user', 'space')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_reports_status_created_idx
  ON public.safety_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS safety_reports_target_idx
  ON public.safety_reports (target_type, target_id);

ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_reports_insert_own" ON public.safety_reports;
CREATE POLICY "safety_reports_insert_own"
  ON public.safety_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

REVOKE ALL ON TABLE public.safety_reports FROM PUBLIC, anon, authenticated;
GRANT INSERT (target_type, target_id, reason, description)
  ON TABLE public.safety_reports TO authenticated;
