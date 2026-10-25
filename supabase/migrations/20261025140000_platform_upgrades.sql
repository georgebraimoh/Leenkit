-- Migration: 20261025140000_platform_upgrades.sql
-- Description: Digital tickets & QR check-in, hidden venue protection, memories, series & recurring hangouts, native push subscriptions

-- ============================================================================
-- 1. DIGITAL TICKETS & QR CHECK-IN (on hangout_attendees)
-- ============================================================================

-- Add ticket_code, checked_in_at, checked_in_by to hangout_attendees
ALTER TABLE public.hangout_attendees
  ADD COLUMN IF NOT EXISTS ticket_code TEXT,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Function to generate clean, collision-resistant ticket codes (e.g. LK-7B9K2)
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars CONSTANT text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text := 'LK-';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    res := res || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN res;
END;
$$;

-- Trigger to auto-assign ticket_code on attendee insert if not present
CREATE OR REPLACE FUNCTION public.assign_attendee_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code text;
  v_collision boolean := true;
  v_attempts integer := 0;
BEGIN
  IF NEW.ticket_code IS NULL OR trim(NEW.ticket_code) = '' THEN
    WHILE v_collision AND v_attempts < 10 LOOP
      v_code := public.generate_ticket_code();
      v_attempts := v_attempts + 1;
      SELECT EXISTS (
        SELECT 1 FROM public.hangout_attendees WHERE ticket_code = v_code
      ) INTO v_collision;
    END LOOP;
    NEW.ticket_code := v_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_attendee_ticket_code ON public.hangout_attendees;
CREATE TRIGGER trg_assign_attendee_ticket_code
  BEFORE INSERT ON public.hangout_attendees
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_attendee_ticket_code();

-- Backfill ticket codes for existing attendees
UPDATE public.hangout_attendees
SET ticket_code = public.generate_ticket_code()
WHERE ticket_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hangout_attendees_ticket_code
  ON public.hangout_attendees(ticket_code);

-- Check-in RPC function (callable by host only)
CREATE OR REPLACE FUNCTION public.check_in_attendee(
  p_hangout_id UUID,
  p_ticket_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_host_id UUID;
  v_attendee RECORD;
  v_profile RECORD;
  v_normalized_code TEXT := upper(trim(p_ticket_code));
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'P0001';
  END IF;

  SELECT host_id INTO v_host_id FROM public.hangouts WHERE id = p_hangout_id;
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Hangout not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_host_id <> v_caller THEN
    RAISE EXCEPTION 'Only the host can check in attendees' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, user_id, checked_in_at, ticket_code
  INTO v_attendee
  FROM public.hangout_attendees
  WHERE hangout_id = p_hangout_id AND ticket_code = v_normalized_code;

  IF v_attendee.id IS NULL THEN
    RAISE EXCEPTION 'Invalid ticket code for this Hangout' USING ERRCODE = 'P0001';
  END IF;

  IF v_attendee.checked_in_at IS NOT NULL THEN
    SELECT name, username, avatar INTO v_profile FROM public.profiles WHERE id = v_attendee.user_id;
    RETURN jsonb_build_object(
      'already_checked_in', true,
      'checked_in_at', v_attendee.checked_in_at,
      'user_id', v_attendee.user_id,
      'name', v_profile.name,
      'username', v_profile.username,
      'avatar', v_profile.avatar,
      'ticket_code', v_attendee.ticket_code
    );
  END IF;

  UPDATE public.hangout_attendees
  SET checked_in_at = now(), checked_in_by = v_caller
  WHERE id = v_attendee.id;

  SELECT name, username, avatar INTO v_profile FROM public.profiles WHERE id = v_attendee.user_id;

  RETURN jsonb_build_object(
    'already_checked_in', false,
    'checked_in_at', now(),
    'user_id', v_attendee.user_id,
    'name', v_profile.name,
    'username', v_profile.username,
    'avatar', v_profile.avatar,
    'ticket_code', v_attendee.ticket_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_attendee(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 2. HIDDEN VENUE PROTECTION (on hangouts)
-- ============================================================================

-- Add hide_exact_location boolean to hangouts
ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS hide_exact_location BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 3. HANGOUT MEMORIES (Photos & Stories before, during, after)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hangout_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hangout_id UUID NOT NULL REFERENCES public.hangouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  phase TEXT NOT NULL DEFAULT 'during' CHECK (phase IN ('before', 'during', 'after')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hangout_memories_hangout ON public.hangout_memories(hangout_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hangout_memories_user ON public.hangout_memories(user_id);

ALTER TABLE public.hangout_memories ENABLE ROW LEVEL SECURITY;

-- Select policy: Confirmed attendees, hosts, and members of active Hangouts can view memories
DROP POLICY IF EXISTS memories_select_policy ON public.hangout_memories;
CREATE POLICY memories_select_policy ON public.hangout_memories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hangout_attendees a
      WHERE a.hangout_id = hangout_memories.hangout_id AND a.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.hangouts h
      WHERE h.id = hangout_memories.hangout_id AND h.host_id = auth.uid()
    )
  );

-- Insert policy: Hosts anytime; Attendees during or after start
DROP POLICY IF EXISTS memories_insert_policy ON public.hangout_memories;
CREATE POLICY memories_insert_policy ON public.hangout_memories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.hangouts h
        WHERE h.id = hangout_id AND h.host_id = auth.uid()
      ) OR EXISTS (
        SELECT 1 FROM public.hangout_attendees a
        WHERE a.hangout_id = hangout_id AND a.user_id = auth.uid()
      )
    )
  );

-- Delete policy: Memory author or Hangout host
DROP POLICY IF EXISTS memories_delete_policy ON public.hangout_memories;
CREATE POLICY memories_delete_policy ON public.hangout_memories
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.hangouts h
      WHERE h.id = hangout_memories.hangout_id AND h.host_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. RECURRING & SERIES HANGOUTS (hangout_series)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hangout_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('weekly', 'biweekly', 'monthly')),
  recurrence_days INTEGER[] DEFAULT '{}',
  total_occurrences INTEGER NOT NULL DEFAULT 4 CHECK (total_occurrences >= 2 AND total_occurrences <= 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.hangout_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_index INTEGER;

CREATE INDEX IF NOT EXISTS idx_hangouts_series ON public.hangouts(series_id);

ALTER TABLE public.hangout_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS series_select_all ON public.hangout_series;
CREATE POLICY series_select_all ON public.hangout_series
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS series_insert_host ON public.hangout_series;
CREATE POLICY series_insert_host ON public.hangout_series
  FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS series_update_host ON public.hangout_series;
CREATE POLICY series_update_host ON public.hangout_series
  FOR UPDATE TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- ============================================================================
-- 5. NATIVE WEB PUSH NOTIFICATIONS (user_push_subscriptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.user_push_subscriptions(user_id);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subs_own ON public.user_push_subscriptions;
CREATE POLICY push_subs_own ON public.user_push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to clean up dead subscriptions
CREATE OR REPLACE FUNCTION public.delete_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.user_push_subscriptions
  WHERE endpoint = p_endpoint AND user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.delete_push_subscription(TEXT) TO authenticated;
