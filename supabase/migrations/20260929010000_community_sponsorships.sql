-- Migration: 20260929010000_community_sponsorships.sql
-- Description: Community Sponsorship (Pledge) schema, constraints, and RLS policies

CREATE TABLE IF NOT EXISTS public.hangout_sponsorships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id UUID NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  sponsor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pledged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hangout_sponsorships_amount_chk CHECK (amount > 0),
  CONSTRAINT hangout_sponsorships_currency_chk CHECK (currency IN ('NGN', 'USD', 'EUR', 'GBP')),
  CONSTRAINT hangout_sponsorships_status_chk CHECK (status IN ('pledged'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS hangout_sponsorships_hangout_idx ON public.hangout_sponsorships (hangout_id);
CREATE INDEX IF NOT EXISTS hangout_sponsorships_sponsor_idx ON public.hangout_sponsorships (sponsor_id);
CREATE INDEX IF NOT EXISTS hangout_sponsorships_created_idx ON public.hangout_sponsorships (created_at DESC);

-- Enable RLS
ALTER TABLE public.hangout_sponsorships ENABLE ROW LEVEL SECURITY;

-- RLS INSERT Policy: User must be authenticated AND exist in hangout_attendees for the target hangout
DROP POLICY IF EXISTS "hangout_sponsorships_insert_attendee" ON public.hangout_sponsorships;
CREATE POLICY "hangout_sponsorships_insert_attendee"
  ON public.hangout_sponsorships FOR INSERT
  TO authenticated
  WITH CHECK (
    sponsor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hangout_attendees
      WHERE hangout_id = hangout_sponsorships.hangout_id
        AND user_id = auth.uid()
    )
  );

-- RLS SELECT Policy: Sponsors can read their own pledges; Hosts can read pledges for their hangouts
DROP POLICY IF EXISTS "hangout_sponsorships_select_own_or_host" ON public.hangout_sponsorships;
CREATE POLICY "hangout_sponsorships_select_own_or_host"
  ON public.hangout_sponsorships FOR SELECT
  TO authenticated
  USING (
    sponsor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.hangouts
      WHERE id = hangout_sponsorships.hangout_id
        AND host_id = auth.uid()
    )
  );

-- Permissions
GRANT SELECT, INSERT ON TABLE public.hangout_sponsorships TO authenticated;
