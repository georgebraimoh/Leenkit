-- Migration: 20260929210000_paystack_production_hardening.sql
-- Description: Production hardening for Paystack integration: RLS lockdown on payment_events and audit guarantees

-- 1. Ensure RLS on public.payment_events explicitly denies standard client access
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies on payment_events if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_events') THEN
    EXECUTE (
      SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON public.payment_events;', ' ')
      FROM pg_policies WHERE tablename = 'payment_events'
    );
  END IF;
END $$;

-- Table public.payment_events is intentionally accessible ONLY to service_role (Edge Functions)
-- No SELECT, INSERT, UPDATE, DELETE policies are granted to 'authenticated' or 'anon' roles.

-- 2. Verify payments table RLS policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'payments_select_own') THEN
    CREATE POLICY "payments_select_own"
      ON public.payments FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- 3. Confirm index existence for production queries
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments (user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_hangout_type ON public.payments (hangout_id, payment_type);
