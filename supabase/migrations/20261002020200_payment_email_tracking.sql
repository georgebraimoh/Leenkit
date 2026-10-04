-- Migration: 20261002020200_payment_email_tracking.sql
-- Description: Track transactional payment emails (sent through Resend by the
-- Paystack Edge Functions) so each one is sent at most once.
--
-- The webhook and the verify function can both see the same settled payment,
-- and Paystack retries webhooks. Before sending, an Edge Function (service
-- role) claims the email with
--   UPDATE payments SET <col> = now() WHERE id = ... AND <col> IS NULL
-- so only one caller sends. If the provider call fails, the claim is cleared
-- so a later event can retry. Settlement never depends on email delivery.
--
-- Additive only: nullable columns, no backfill, no policy or grant changes.
-- Existing payments keep NULL (no emails are sent retroactively by this
-- migration).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_notice_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_error text;
