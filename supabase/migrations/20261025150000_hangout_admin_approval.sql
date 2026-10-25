-- ============================================================================
-- Migration: 20261025150000_hangout_admin_approval.sql
-- Description: Admin review and approval workflow for Hangouts
-- ============================================================================

-- 1. Add approval columns to public.hangouts
ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.hangouts
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hangouts_approval_status ON public.hangouts(approval_status);

-- Ensure all pre-existing hangouts are marked approved
UPDATE public.hangouts
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- 2. Update hangouts_before_insert trigger
CREATE OR REPLACE FUNCTION public.hangouts_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.status := 'upcoming';
    NEW.featured := false;
    NEW.is_popular := false;
    NEW.attendee_count := 0;
    IF NEW.approval_status IS NULL THEN
      NEW.approval_status := 'pending';
    END IF;
    IF NEW.date IS NOT NULL AND NEW.date < current_date - 1 THEN
      RAISE EXCEPTION 'A Hangout cannot be scheduled in the past';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Admin RPC: List hangouts with filter and host details
DROP FUNCTION IF EXISTS public.admin_list_hangouts(TEXT);
CREATE OR REPLACE FUNCTION public.admin_list_hangouts(p_approval_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  title TEXT,
  description TEXT,
  category TEXT,
  image TEXT,
  hangout_date DATE,
  hangout_time TIME,
  place_name TEXT,
  address TEXT,
  city TEXT,
  max_attendees INTEGER,
  attendee_count INTEGER,
  is_paid BOOLEAN,
  price NUMERIC,
  currency TEXT,
  status TEXT,
  approval_status TEXT,
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  host_id UUID,
  host_name TEXT,
  host_username TEXT,
  host_avatar TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.created_at,
    h.title,
    h.description,
    h.category,
    h.image,
    h.date AS hangout_date,
    h.time AS hangout_time,
    h.place_name,
    h.address,
    h.city,
    h.max_attendees,
    h.attendee_count,
    h.is_paid,
    h.price,
    h.currency,
    h.status,
    h.approval_status,
    h.rejection_reason,
    h.reviewed_at,
    h.host_id,
    p.name AS host_name,
    p.username AS host_username,
    p.avatar AS host_avatar
  FROM public.hangouts h
  LEFT JOIN public.profiles p ON p.id = h.host_id
  WHERE (p_approval_status IS NULL OR h.approval_status = p_approval_status)
  ORDER BY
    CASE WHEN h.approval_status = 'pending' THEN 0 ELSE 1 END,
    h.created_at DESC;
END;
$$;

-- 4. Admin RPC: Approve or Reject a Hangout
DROP FUNCTION IF EXISTS public.admin_review_hangout(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.admin_review_hangout(
  p_hangout_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_hangout RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_hangout FROM public.hangouts WHERE id = p_hangout_id;
  IF v_hangout.id IS NULL THEN
    RAISE EXCEPTION 'Hangout not found' USING ERRCODE = 'P0001';
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.hangouts
    SET approval_status = 'approved',
        reviewed_at = now(),
        reviewed_by = v_caller,
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = p_hangout_id;

    -- Audit log
    PERFORM public.admin_audit('hangout_approved', 'hangout', p_hangout_id, jsonb_build_object('title', v_hangout.title));

    -- Post opening/approval notification message in Space
    PERFORM public.post_system_message(p_hangout_id, v_caller, 'This Hangout has been reviewed and approved by LEENKIT. It is now open to everyone!');

    RETURN jsonb_build_object('success', true, 'approval_status', 'approved');

  ELSIF p_action = 'reject' THEN
    UPDATE public.hangouts
    SET approval_status = 'rejected',
        reviewed_at = now(),
        reviewed_by = v_caller,
        rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Did not meet hosting guidelines'),
        updated_at = now()
    WHERE id = p_hangout_id;

    -- Audit log
    PERFORM public.admin_audit('hangout_rejected', 'hangout', p_hangout_id, jsonb_build_object('title', v_hangout.title, 'reason', p_reason));

    -- Post rejection message in Space for host
    PERFORM public.post_system_message(p_hangout_id, v_caller, 'This Hangout was not approved: ' || coalesce(nullif(trim(p_reason), ''), 'Did not meet hosting guidelines'));

    RETURN jsonb_build_object('success', true, 'approval_status', 'rejected');

  ELSE
    RAISE EXCEPTION 'Invalid review action. Use approve or reject.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- 5. Update admin_overview to count pending_hangouts
DROP FUNCTION IF EXISTS public.admin_overview();
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS TABLE (
  pending_reports bigint,
  refunds_due bigint,
  suspended_users bigint,
  payout_accounts bigint,
  fees_collected_ngn numeric,
  pending_hangouts bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  RETURN QUERY SELECT
    (SELECT count(*) FROM public.safety_reports WHERE status IN ('pending', 'reviewing')),
    (SELECT count(*) FROM public.payments WHERE status = 'requires_refund'),
    (SELECT count(*) FROM public.profiles WHERE suspended_at IS NOT NULL),
    (SELECT count(*) FROM public.host_payout_accounts),
    (SELECT coalesce(sum(platform_fee), 0) FROM public.payments WHERE status = 'successful' AND currency = 'NGN'),
    (SELECT count(*) FROM public.hangouts WHERE approval_status = 'pending');
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.admin_list_hangouts(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_hangouts(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_review_hangout(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_hangout(UUID, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;
