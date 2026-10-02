-- Migration: 20261002000000_security_hardening.sql
-- Description: Fixes from the LEENKIT audit (S1-S5, S7, S9-S11).
--
--  S1  Capacity is enforced for every join (trigger now SECURITY DEFINER),
--      and closed / past Hangouts cannot be joined.
--  S2  Space messages: sender name/avatar come from profiles, clients can only
--      post type 'user'. Join/leave/create/cancel notices are written by the
--      database itself.
--  S3  Sponsorship pledges cannot be inserted as 'paid' or linked to payments.
--  S4  Payment records are never cascade-deleted.
--  S5  Hosts can only change editable columns; price fields lock once a
--      payment exists; status only moves forward from 'upcoming'.
--  S7  settle_payment(): one atomic, idempotent settlement path used by the
--      Paystack webhook and the verify function.
--  S9  Attendee lists are visible to that Hangout's members only; everyone
--      else sees hangouts.attendee_count.
--  S10 Clients can no longer insert profile rows (the auth trigger does it).
--  S11 Database-side URL and length checks.
--
-- New CHECK constraints are added NOT VALID so existing rows are untouched;
-- they apply to every new insert/update.

-- ---------------------------------------------------------------------------
-- 0. Helper: post a system message as the database (not as a client)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_system_message(p_hangout_id uuid, p_user_id uuid, p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hangouts WHERE id = p_hangout_id)
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN; -- parent row is being deleted (cascade); nothing to announce
  END IF;

  PERFORM set_config('leenkit.system_message', 'on', true);
  INSERT INTO public.hangout_messages (hangout_id, user_id, text, type)
  VALUES (p_hangout_id, p_user_id, p_text, 'system');
  PERFORM set_config('leenkit.system_message', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.post_system_message(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Attendee count column (S9) + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangouts ADD COLUMN IF NOT EXISTS attendee_count integer NOT NULL DEFAULT 0;

UPDATE public.hangouts h
SET attendee_count = sub.n
FROM (
  SELECT hangout_id, count(*)::int AS n
  FROM public.hangout_attendees
  GROUP BY hangout_id
) sub
WHERE sub.hangout_id = h.id
  AND h.attendee_count IS DISTINCT FROM sub.n;

-- ---------------------------------------------------------------------------
-- 2. S1: capacity + open-for-joining check, as definer, with a row lock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_hangout_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  h record;
BEGIN
  SELECT id, host_id, max_attendees, attendee_count, status, date
  INTO h
  FROM public.hangouts
  WHERE id = NEW.hangout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_HANGOUT_NOT_FOUND';
  END IF;

  -- The host's own attendance row is always allowed (created with the Hangout).
  IF NEW.user_id = h.host_id THEN
    RETURN NEW;
  END IF;

  IF h.status <> 'upcoming' OR (h.date IS NOT NULL AND h.date < current_date - 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_HANGOUT_CLOSED';
  END IF;

  IF h.max_attendees IS NOT NULL AND h.attendee_count >= h.max_attendees THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_CAPACITY_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_hangout_capacity() FROM PUBLIC, anon, authenticated;

-- Keep attendee_count in step and post join/leave notices.
CREATE OR REPLACE FUNCTION public.on_hangout_attendee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_host uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hangouts SET attendee_count = attendee_count + 1 WHERE id = NEW.hangout_id
    RETURNING host_id INTO v_host;

    IF v_host IS NOT NULL AND NEW.user_id <> v_host THEN
      SELECT coalesce(name, 'A member') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
      PERFORM public.post_system_message(NEW.hangout_id, NEW.user_id, v_name || ' joined the Hangout.');
    END IF;
    RETURN NEW;
  ELSE
    UPDATE public.hangouts SET attendee_count = greatest(attendee_count - 1, 0) WHERE id = OLD.hangout_id
    RETURNING host_id INTO v_host;

    IF v_host IS NOT NULL AND OLD.user_id <> v_host THEN
      SELECT coalesce(name, 'A member') INTO v_name FROM public.profiles WHERE id = OLD.user_id;
      IF v_name IS NOT NULL THEN
        PERFORM public.post_system_message(OLD.hangout_id, OLD.user_id, v_name || ' left the Hangout.');
      END IF;
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.on_hangout_attendee_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangout_attendees_count_insert ON public.hangout_attendees;
CREATE TRIGGER hangout_attendees_count_insert
  AFTER INSERT ON public.hangout_attendees
  FOR EACH ROW EXECUTE PROCEDURE public.on_hangout_attendee_change();

DROP TRIGGER IF EXISTS hangout_attendees_count_delete ON public.hangout_attendees;
CREATE TRIGGER hangout_attendees_count_delete
  AFTER DELETE ON public.hangout_attendees
  FOR EACH ROW EXECUTE PROCEDURE public.on_hangout_attendee_change();

-- ---------------------------------------------------------------------------
-- 3. S9: attendee rows visible to the Hangout's members only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "hangout_attendees_select_public" ON public.hangout_attendees;
DROP POLICY IF EXISTS "hangout_attendees_select_members" ON public.hangout_attendees;
CREATE POLICY "hangout_attendees_select_members"
  ON public.hangout_attendees FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_hangout_member(hangout_id, auth.uid())
  );

REVOKE SELECT ON TABLE public.hangout_attendees FROM anon;

-- Clients join free Hangouts only, and only open ones (the trigger re-checks).
DROP POLICY IF EXISTS "hangout_attendees_insert_own" ON public.hangout_attendees;
CREATE POLICY "hangout_attendees_insert_own"
  ON public.hangout_attendees FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.hangouts h
      WHERE h.id = hangout_id
        AND (h.is_paid IS FALSE OR h.is_paid IS NULL)
        AND h.status = 'upcoming'
    )
  );

-- Membership check no longer needs to be callable by anonymous visitors.
REVOKE EXECUTE ON FUNCTION public.is_hangout_member(uuid, uuid) FROM anon;

-- ---------------------------------------------------------------------------
-- 4. Hangouts: insert/update column grants, host auto-attend, guards (S5)
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON TABLE public.hangouts FROM authenticated;

GRANT INSERT (
  host_id, title, description, category, image, date, time,
  place_name, address, city, country, country_code, latitude, longitude,
  google_maps_url, max_attendees, is_paid, price, currency
) ON TABLE public.hangouts TO authenticated;

GRANT UPDATE (
  title, description, category, image, date, time,
  place_name, address, city, country, country_code, latitude, longitude,
  google_maps_url, max_attendees, is_paid, price, currency, status
) ON TABLE public.hangouts TO authenticated;

-- featured / is_popular / attendee_count / host_id stay server-controlled.

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
    IF NEW.date IS NOT NULL AND NEW.date < current_date - 1 THEN
      RAISE EXCEPTION 'A Hangout cannot be scheduled in the past';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS hangouts_before_insert ON public.hangouts;
CREATE TRIGGER hangouts_before_insert
  BEFORE INSERT ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.hangouts_before_insert();

-- Host becomes the first attendee, and the Space gets its opening notice.
CREATE OR REPLACE FUNCTION public.hangouts_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
BEGIN
  INSERT INTO public.hangout_attendees (hangout_id, user_id)
  VALUES (NEW.id, NEW.host_id)
  ON CONFLICT (hangout_id, user_id) DO NOTHING;

  SELECT coalesce(name, 'The host') INTO v_name FROM public.profiles WHERE id = NEW.host_id;
  PERFORM public.post_system_message(NEW.id, NEW.host_id, v_name || ' created the Hangout and opened the LEENKIT Space.');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangouts_after_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_after_insert ON public.hangouts;
CREATE TRIGGER hangouts_after_insert
  AFTER INSERT ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.hangouts_after_insert();

CREATE OR REPLACE FUNCTION public.hangouts_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.host_id IS DISTINCT FROM OLD.host_id THEN
    RAISE EXCEPTION 'The host of a Hangout cannot be changed';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('upcoming', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Unsupported Hangout status';
    END IF;
    IF OLD.status <> 'upcoming' THEN
      RAISE EXCEPTION 'Only upcoming Hangouts can be cancelled or completed';
    END IF;
  END IF;

  IF (NEW.is_paid, NEW.price, NEW.currency) IS DISTINCT FROM (OLD.is_paid, OLD.price, OLD.currency)
     AND EXISTS (
       SELECT 1 FROM public.payments p
       WHERE p.hangout_id = OLD.id
         AND p.payment_type = 'ticket'
         AND p.status IN ('pending', 'successful', 'requires_refund')
     ) THEN
    RAISE EXCEPTION 'Ticket price cannot change after tickets have been sold';
  END IF;

  IF NEW.max_attendees IS DISTINCT FROM OLD.max_attendees
     AND NEW.max_attendees < OLD.attendee_count THEN
    RAISE EXCEPTION 'Capacity cannot be lower than the number of people already going';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangouts_before_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_before_update ON public.hangouts;
CREATE TRIGGER hangouts_before_update
  BEFORE UPDATE ON public.hangouts
  FOR EACH ROW EXECUTE PROCEDURE public.hangouts_before_update();

-- Tell attendees when a Hangout is cancelled.
CREATE OR REPLACE FUNCTION public.notify_attendees_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    INSERT INTO public.notifications (user_id, actor_id, hangout_id, type, title, message, is_read, created_at)
    SELECT a.user_id, NEW.host_id, NEW.id, 'hangout_cancelled',
           'A Hangout you joined was cancelled',
           coalesce(NEW.title, 'A Hangout') || ' has been cancelled by the host.',
           false, now()
    FROM public.hangout_attendees a
    WHERE a.hangout_id = NEW.id AND a.user_id <> NEW.host_id
    ON CONFLICT (user_id, hangout_id, type) WHERE hangout_id IS NOT NULL
    DO UPDATE SET is_read = false, created_at = now();

    PERFORM public.post_system_message(NEW.id, NEW.host_id, 'The host cancelled this Hangout.');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_attendees_on_cancel warning: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_attendees_on_cancel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangouts_notify_cancel ON public.hangouts;
CREATE TRIGGER hangouts_notify_cancel
  AFTER UPDATE OF status ON public.hangouts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
  EXECUTE PROCEDURE public.notify_attendees_on_cancel();

-- ---------------------------------------------------------------------------
-- 5. S2: message sender identity comes from profiles; clients post 'user' only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hangout_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  IF coalesce(current_setting('leenkit.system_message', true), '') <> 'on' THEN
    NEW.type := 'user';
    IF EXISTS (SELECT 1 FROM public.hangouts WHERE id = NEW.hangout_id AND status = 'cancelled') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LEENKIT_HANGOUT_CLOSED';
    END IF;
  END IF;

  SELECT name, avatar INTO v_name, v_avatar FROM public.profiles WHERE id = NEW.user_id;
  NEW.user_name := coalesce(v_name, 'LEENKIT Member');
  NEW.user_avatar := v_avatar;
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hangout_messages_before_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hangout_messages_before_insert ON public.hangout_messages;
CREATE TRIGGER hangout_messages_before_insert
  BEFORE INSERT ON public.hangout_messages
  FOR EACH ROW EXECUTE PROCEDURE public.hangout_messages_before_insert();

ALTER TABLE public.hangout_messages DROP CONSTRAINT IF EXISTS hangout_messages_text_len_chk;
ALTER TABLE public.hangout_messages
  ADD CONSTRAINT hangout_messages_text_len_chk CHECK (char_length(text) <= 2000) NOT VALID;

-- System notices should not ping everyone as "new message".
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
  IF NEW.type = 'system' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT coalesce(name, 'An attendee') INTO sender_name
    FROM public.profiles
    WHERE id = NEW.user_id;

    SELECT coalesce(title, 'a Hangout') INTO hangout_title
    FROM public.hangouts
    WHERE id = NEW.hangout_id;

    INSERT INTO public.notifications (
      user_id, actor_id, hangout_id, type, title, message, is_read, created_at
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

-- ---------------------------------------------------------------------------
-- 6. S3: sponsorship pledges
-- ---------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.hangout_sponsorships FROM authenticated;
GRANT INSERT (hangout_id, sponsor_id, amount, currency, message)
  ON TABLE public.hangout_sponsorships TO authenticated;

DROP POLICY IF EXISTS "hangout_sponsorships_insert_attendee" ON public.hangout_sponsorships;
CREATE POLICY "hangout_sponsorships_insert_attendee"
  ON public.hangout_sponsorships FOR INSERT
  TO authenticated
  WITH CHECK (
    sponsor_id = auth.uid()
    AND status = 'pledged'
    AND payment_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.hangout_attendees a
      JOIN public.hangouts h ON h.id = a.hangout_id
      WHERE a.hangout_id = hangout_sponsorships.hangout_id
        AND a.user_id = auth.uid()
        AND h.status = 'upcoming'
    )
  );

ALTER TABLE public.hangout_sponsorships DROP CONSTRAINT IF EXISTS hangout_sponsorships_amount_max_chk;
ALTER TABLE public.hangout_sponsorships
  ADD CONSTRAINT hangout_sponsorships_amount_max_chk CHECK (amount <= 10000000) NOT VALID;

-- Paid and pledged are reported separately, to members only.
DROP FUNCTION IF EXISTS public.get_hangout_sponsorship_summary(uuid);
CREATE FUNCTION public.get_hangout_sponsorship_summary(p_hangout_id uuid)
RETURNS TABLE (
  currency text,
  total_paid numeric,
  total_pledged numeric,
  sponsor_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.currency,
    coalesce(SUM(s.amount) FILTER (WHERE s.status = 'paid'), 0) AS total_paid,
    coalesce(SUM(s.amount) FILTER (WHERE s.status = 'pledged'), 0) AS total_pledged,
    COUNT(DISTINCT s.sponsor_id) AS sponsor_count
  FROM public.hangout_sponsorships s
  WHERE s.hangout_id = p_hangout_id
    AND s.status IN ('pledged', 'paid')
    AND public.is_hangout_member(p_hangout_id, auth.uid())
  GROUP BY s.currency;
$$;

REVOKE ALL ON FUNCTION public.get_hangout_sponsorship_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hangout_sponsorship_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. S4: payment records survive Hangout/user deletion
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.payments'::regclass
      AND c.contype = 'f'
      AND c.confrelid IN ('public.hangouts'::regclass, 'public.profiles'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_hangout_id_fkey
  FOREIGN KEY (hangout_id) REFERENCES public.hangouts (id) ON DELETE RESTRICT;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 8. S7: one settlement path for Paystack (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_payment(
  p_reference text,
  p_amount_subunits bigint,
  p_currency text,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  pay public.payments;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
BEGIN
  SELECT * INTO pay FROM public.payments WHERE reference = p_reference FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Idempotent: anything already settled is returned as is.
  IF pay.status <> 'pending' THEN
    RETURN pay.status;
  END IF;

  IF p_amount_subunits IS DISTINCT FROM round(pay.amount * 100)::bigint
     OR upper(coalesce(p_currency, '')) <> upper(pay.currency) THEN
    UPDATE public.payments
    SET status = 'flagged_mismatch',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'mismatch', true, 'received_amount', p_amount_subunits, 'received_currency', p_currency),
        updated_at = now()
    WHERE id = pay.id;
    RETURN 'flagged_mismatch';
  END IF;

  IF pay.payment_type = 'ticket' THEN
    BEGIN
      INSERT INTO public.hangout_attendees (hangout_id, user_id)
      VALUES (pay.hangout_id, pay.user_id);
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.payments
        SET status = 'requires_refund', paid_at = v_paid_at, updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || '{"refund_reason":"already_attending"}'::jsonb
        WHERE id = pay.id;
        RETURN 'requires_refund';
      WHEN raise_exception THEN
        UPDATE public.payments
        SET status = 'requires_refund', paid_at = v_paid_at, updated_at = now(),
            metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('refund_reason', SQLERRM)
        WHERE id = pay.id;
        RETURN 'requires_refund';
    END;
  ELSIF pay.payment_type = 'sponsorship' THEN
    INSERT INTO public.hangout_sponsorships (hangout_id, sponsor_id, amount, currency, message, status, payment_id)
    VALUES (pay.hangout_id, pay.user_id, pay.amount, pay.currency, pay.metadata->>'message', 'paid', pay.id)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.payments
  SET status = 'successful', paid_at = v_paid_at, updated_at = now()
  WHERE id = pay.id;

  RETURN 'successful';
END;
$$;

REVOKE ALL ON FUNCTION public.settle_payment(text, bigint, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment(text, bigint, text, timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. S10: profiles are created by handle_new_user() only
-- ---------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.profiles FROM authenticated;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- ---------------------------------------------------------------------------
-- 10. S11: database-side validation (new rows and edits)
-- ---------------------------------------------------------------------------
ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_status_chk;
ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_status_chk CHECK (status IN ('upcoming', 'completed', 'cancelled')) NOT VALID;

ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_google_maps_url_chk;
ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_google_maps_url_chk CHECK (
    google_maps_url IS NULL
    OR google_maps_url ~* '^https?://([a-z0-9-]+\.)*(google\.[a-z.]+|goo\.gl)/'
  ) NOT VALID;

ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_image_chk;
ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_image_chk CHECK (image IS NULL OR image ~* '^https://') NOT VALID;

ALTER TABLE public.hangouts DROP CONSTRAINT IF EXISTS hangouts_text_len_chk;
ALTER TABLE public.hangouts
  ADD CONSTRAINT hangouts_text_len_chk CHECK (
    char_length(title) <= 120
    AND (description IS NULL OR char_length(description) <= 5000)
    AND (place_name IS NULL OR char_length(place_name) <= 200)
  ) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_urls_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_social_urls_chk CHECK (
    (instagram_url IS NULL OR instagram_url = '' OR instagram_url ~* '^https://([a-z0-9-]+\.)*instagram\.com/')
    AND (tiktok_url IS NULL OR tiktok_url = '' OR tiktok_url ~* '^https://([a-z0-9-]+\.)*tiktok\.com/')
    AND (spotify_url IS NULL OR spotify_url = '' OR spotify_url ~* '^https://([a-z0-9-]+\.)*spotify\.com/')
  ) NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_chk CHECK (avatar IS NULL OR avatar = '' OR avatar ~* '^https://') NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_text_len_chk;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_text_len_chk CHECK (
    (name IS NULL OR char_length(name) <= 80)
    AND (bio IS NULL OR char_length(bio) <= 500)
    AND (location IS NULL OR char_length(location) <= 120)
  ) NOT VALID;
