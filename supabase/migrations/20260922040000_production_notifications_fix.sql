-- Migration: 20260922040000_production_notifications_fix.sql
-- Fixes Qleenq Notifications System for Production Supabase DB

-- 0. Ensure public.notifications table exists with RLS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  hangout_id uuid REFERENCES public.hangouts (id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

-- 1. Structural Fix: Ensure hangout_id is NULLABLE for vibe notifications
ALTER TABLE public.notifications ALTER COLUMN hangout_id DROP NOT NULL;

-- 2. Clean up old indexes/constraints if existing
DROP INDEX IF EXISTS public.notifications_unique_vibe;
DROP INDEX IF EXISTS public.notifications_unique_hangout_join;
DROP INDEX IF EXISTS public.notifications_user_hangout_type_idx;
DROP INDEX IF EXISTS public.notifications_user_actor_type_idx;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_unique;

-- 3. Create Clean, Non-Conflicting Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_hangout_type_idx
  ON public.notifications (user_id, hangout_id, type)
  WHERE hangout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_actor_type_idx
  ON public.notifications (user_id, actor_id, type)
  WHERE hangout_id IS NULL;

-- 4. Enable REPLICA IDENTITY FULL for Supabase Realtime RLS filtering
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 5. Add Table to supabase_realtime Publication if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Trigger Function 1: Vibe Notification (on public.follows INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_vibe_on_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
BEGIN
  BEGIN
    IF NEW.follower_id = NEW.following_id THEN
      RETURN NEW;
    END IF;

    SELECT coalesce(name, 'Someone') INTO actor_name
    FROM public.profiles
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (
      user_id,
      actor_id,
      hangout_id,
      type,
      title,
      message,
      is_read,
      created_at
    )
    VALUES (
      NEW.following_id,
      NEW.follower_id,
      NULL,
      'vibe',
      'Someone is vibing with you',
      actor_name || ' is now vibing with you.',
      false,
      now()
    )
    ON CONFLICT (user_id, actor_id, type) WHERE hangout_id IS NULL
    DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      is_read = false,
      created_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_vibe_on_follow warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_created_notify_vibe ON public.follows;
CREATE TRIGGER on_follow_created_notify_vibe
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_vibe_on_follow();

-- ---------------------------------------------------------------------------
-- Trigger Function 2: Space Message Notification (on public.hangout_messages INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_space_message_attendees()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  hangout_title text;
BEGIN
  BEGIN
    SELECT coalesce(name, 'An attendee') INTO sender_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    SELECT coalesce(title, 'a Hangout') INTO hangout_title
    FROM public.hangouts
    WHERE id = NEW.hangout_id;

    INSERT INTO public.notifications (
      user_id,
      actor_id,
      hangout_id,
      type,
      title,
      message,
      is_read,
      created_at
    )
    SELECT DISTINCT
      target_id,
      NEW.user_id,
      NEW.hangout_id,
      'space_message',
      'New message in a Hangout',
      sender_name || ' sent a new message in ' || hangout_title,
      false,
      now()
    FROM (
      SELECT user_id AS target_id FROM public.hangout_attendees WHERE hangout_id = NEW.hangout_id
      UNION
      SELECT host_id AS target_id FROM public.hangouts WHERE id = NEW.hangout_id
    ) targets
    WHERE target_id != NEW.user_id
    ON CONFLICT (user_id, hangout_id, type) WHERE hangout_id IS NOT NULL
    DO UPDATE SET
      actor_id = EXCLUDED.actor_id,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      is_read = false,
      created_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_space_message_attendees warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_space_message_inserted_notify_attendees ON public.hangout_messages;
CREATE TRIGGER on_space_message_inserted_notify_attendees
  AFTER INSERT ON public.hangout_messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_space_message_attendees();

-- ---------------------------------------------------------------------------
-- Trigger Function 3: Vibe Follower New Hangout Notification (on public.hangouts INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_vibe_followers_on_hangout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_name text;
BEGIN
  BEGIN
    SELECT coalesce(name, 'Someone you vibe with') INTO host_name
    FROM public.profiles
    WHERE id = NEW.host_id;

    INSERT INTO public.notifications (
      user_id,
      actor_id,
      hangout_id,
      type,
      title,
      message,
      is_read,
      created_at
    )
    SELECT
      f.follower_id,
      NEW.host_id,
      NEW.id,
      'vibe_hangout',
      'New Hangout from someone you vibe with',
      host_name || ' is hosting a new Hangout: ' || NEW.title,
      false,
      now()
    FROM public.follows f
    WHERE f.following_id = NEW.host_id
      AND f.follower_id != NEW.host_id
    ON CONFLICT (user_id, hangout_id, type) WHERE hangout_id IS NOT NULL
    DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_vibe_followers_on_hangout warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_hangout_created_notify_followers ON public.hangouts;
CREATE TRIGGER on_hangout_created_notify_followers
  AFTER INSERT ON public.hangouts
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_vibe_followers_on_hangout();

-- ---------------------------------------------------------------------------
-- Trigger Function 4: Hangout Join Notification for Host (on public.hangout_attendees INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_host_on_hangout_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  host_user_id uuid;
  joiner_name text;
  hangout_title text;
BEGIN
  BEGIN
    SELECT host_id, coalesce(title, 'your Hangout') INTO host_user_id, hangout_title
    FROM public.hangouts
    WHERE id = NEW.hangout_id;

    IF host_user_id IS NULL OR NEW.user_id = host_user_id THEN
      RETURN NEW;
    END IF;

    SELECT coalesce(name, 'Someone') INTO joiner_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (
      user_id,
      actor_id,
      hangout_id,
      type,
      title,
      message,
      is_read,
      created_at
    )
    VALUES (
      host_user_id,
      NEW.user_id,
      NEW.hangout_id,
      'hangout_join',
      'Someone joined your Hangout',
      joiner_name || ' joined your Hangout: ' || hangout_title,
      false,
      now()
    )
    ON CONFLICT (user_id, hangout_id, type) WHERE hangout_id IS NOT NULL
    DO UPDATE SET
      actor_id = EXCLUDED.actor_id,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      is_read = false,
      created_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_host_on_hangout_join warning: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_hangout_attendee_joined_notify_host ON public.hangout_attendees;
CREATE TRIGGER on_hangout_attendee_joined_notify_host
  AFTER INSERT ON public.hangout_attendees
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_host_on_hangout_join();
