-- Migration: 20261002020200_payment_email_tracking.sql
-- Description: Durable tracking for transactional payment emails (sent
-- through Resend by Edge Functions). Each payment row acts as its own outbox.
--
-- Per email kind there are two columns:
--   <kind>_email_sent_at  claim time (set before sending)
--   <kind>_email_id       Resend message id (set after the provider accepts)
-- A claim without an id that is older than 15 minutes is stale (the function
-- died mid-send) and may be retried. Resend's Idempotency-Key (same key per
-- payment + kind) prevents a duplicate if the first attempt had in fact been
-- accepted. A scheduled `email-retry` Edge Function sweeps missed/failed
-- emails; settlement never depends on email delivery.
--
-- emails_enabled: existing payments get FALSE (no emails are ever sent
-- retroactively for payments made before this feature); new rows default to
-- TRUE. Achieved with the column default only, no UPDATE of existing rows.
--
-- Additive only: no policy or grant changes. Only the service role writes
-- these columns.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS emails_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments
  ALTER COLUMN emails_enabled SET DEFAULT true;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_email_id text,
  ADD COLUMN IF NOT EXISTS refund_notice_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_notice_email_id text,
  ADD COLUMN IF NOT EXISTS refund_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_email_id text,
  ADD COLUMN IF NOT EXISTS email_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_error text;

-- Sweeper lookup: recent payments in an email-worthy state.
CREATE INDEX IF NOT EXISTS payments_email_outbox_idx
  ON public.payments (status, updated_at DESC)
  WHERE emails_enabled AND status IN ('successful', 'requires_refund', 'refunded');
