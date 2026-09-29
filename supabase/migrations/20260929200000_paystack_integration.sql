-- Migration: 20260929200000_paystack_integration.sql
-- Description: Paystack integration schema, idempotency, constraints, secured attendance RLS, capacity lock, and summary RPC

-- 1. Create public.payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hangout_id UUID NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('ticket', 'sponsorship')),
  reference TEXT UNIQUE NOT NULL,
  paystack_access_code TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD', 'EUR', 'GBP')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'flagged_mismatch', 'requires_refund', 'refunded')),
  metadata JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS payments_hangout_idx ON public.payments (hangout_id);
CREATE INDEX IF NOT EXISTS payments_reference_idx ON public.payments (reference);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);

-- Enable RLS on public.payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view ONLY their own payment records
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_select_own') THEN
    DROP POLICY "payments_select_own" ON public.payments;
  END IF;
END $$;

CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Create public.payment_events table for Webhook Idempotency & Audit
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'flagged_mismatch', 'requires_refund', 'orphaned', 'error')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- 3. Update public.hangout_sponsorships status constraint and add payment_id FK
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hangout_sponsorships_status_chk') THEN
    ALTER TABLE public.hangout_sponsorships DROP CONSTRAINT hangout_sponsorships_status_chk;
  END IF;
END $$;

ALTER TABLE public.hangout_sponsorships 
  ADD CONSTRAINT hangout_sponsorships_status_chk 
  CHECK (status IN ('pledged', 'pending', 'paid', 'failed', 'requires_refund', 'refunded'));

ALTER TABLE public.hangout_sponsorships 
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hangout_sponsorships_payment_id_key 
  ON public.hangout_sponsorships (payment_id) 
  WHERE payment_id IS NOT NULL;

-- 4. Update Capacity Trigger with Explicit Error Code & Row Locking
CREATE OR REPLACE FUNCTION public.enforce_hangout_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cap integer;
  current_count integer;
BEGIN
  -- Row lock the hangout record during attendance check to prevent race conditions
  SELECT max_attendees INTO cap FROM public.hangouts WHERE id = NEW.hangout_id FOR UPDATE;
  SELECT count(*) INTO current_count FROM public.hangout_attendees WHERE hangout_id = NEW.hangout_id;

  IF cap IS NOT NULL AND current_count >= cap THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_CAPACITY_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. SECURE RLS ON public.hangout_attendees
-- Direct client insertion allowed ONLY for Free Hangouts (is_paid = false or null)
-- Paid Hangout attendance is inserted via service_role in verified payment webhooks/Edge functions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hangout_attendees' AND policyname = 'hangout_attendees_insert_own') THEN
    DROP POLICY "hangout_attendees_insert_own" ON public.hangout_attendees;
  END IF;
END $$;

CREATE POLICY "hangout_attendees_insert_own"
  ON public.hangout_attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hangouts h
      WHERE h.id = hangout_id
        AND (h.is_paid IS FALSE OR h.is_paid IS NULL)
    )
  );

-- 6. RPC Function for Currency-Aware Sponsorship Summary
CREATE OR REPLACE FUNCTION public.get_hangout_sponsorship_summary(p_hangout_id UUID)
RETURNS TABLE (
  currency TEXT,
  total_pledged NUMERIC,
  sponsor_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.currency,
    SUM(s.amount) AS total_pledged,
    COUNT(DISTINCT s.sponsor_id) AS sponsor_count
  FROM public.hangout_sponsorships s
  WHERE s.hangout_id = p_hangout_id
    AND s.status IN ('pledged', 'paid')
  GROUP BY s.currency;
$$;

REVOKE ALL ON FUNCTION public.get_hangout_sponsorship_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hangout_sponsorship_summary(UUID) TO authenticated, anon;

-- Grants
GRANT SELECT ON TABLE public.payments TO authenticated;
