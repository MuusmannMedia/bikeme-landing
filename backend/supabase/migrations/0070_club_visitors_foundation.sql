BEGIN;
-- Additive, default-off visitor foundation. Historical/member RPCs are untouched.
CREATE TABLE club_private.visit_flags (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 visits boolean NOT NULL DEFAULT false, applications boolean NOT NULL DEFAULT false,
 rides boolean NOT NULL DEFAULT false, images boolean NOT NULL DEFAULT false
);
INSERT INTO club_private.visit_flags DEFAULT VALUES;
CREATE TABLE club_private.visit_profiles (
 club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT false,
 applications_open boolean NOT NULL DEFAULT false, name text NOT NULL,
 body text NOT NULL DEFAULT '', cover_path text, logo_path text,
 cover_frame jsonb, logo_frame jsonb, published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CHECK(char_length(name) BETWEEN 2 AND 80), CHECK(char_length(body)<=1000)
);
CREATE TABLE club_private.visit_rides (
 ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT false,
 title text NOT NULL CHECK(char_length(title) BETWEEN 2 AND 120),
 body text NOT NULL DEFAULT '' CHECK(char_length(body)<=1000),
 area text NOT NULL DEFAULT '' CHECK(char_length(area)<=100),
 published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE club_private.visit_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 applicant uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 body text NOT NULL DEFAULT '' CHECK(char_length(body)<=500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','rejected','cancelled','expired')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL DEFAULT(clock_timestamp()+interval '30 days'),
 resolved_at timestamptz, resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX visit_application_pending ON club_private.visit_applications(club_id,applicant) WHERE status='pending';
CREATE INDEX visit_application_actor_time ON club_private.visit_applications(applicant,created_at);
CREATE TABLE club_private.visit_restrictions (
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 applicant uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(club_id,applicant)
);
CREATE TABLE club_private.visit_intents (
 actor uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, key uuid NOT NULL,
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 payload jsonb NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor,key)
);
CREATE TABLE club_private.visit_watchers (
 actor uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 touched_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(actor,club_id)
);
DO $$DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['visit_flags','visit_profiles','visit_rides','visit_applications','visit_restrictions','visit_intents','visit_watchers'] LOOP
 EXECUTE format('ALTER TABLE club_private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON club_private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END$$;
CREATE FUNCTION club_private.visit_require(p_feature text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.require_user(); f club_private.visit_flags;
BEGIN
 SELECT * INTO f FROM club_private.visit_flags WHERE singleton;
 IF NOT COALESCE(f.visits,false) OR (p_feature='applications' AND NOT f.applications) OR (p_feature='rides' AND NOT f.rides) OR (p_feature='images' AND NOT f.images) THEN
 RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501'; END IF;
 RETURN a;
END$$;
CREATE FUNCTION club_private.visit_can_read(p_club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM club_private.visit_flags f,club_private.visit_profiles v JOIN public.clubs c ON c.id=v.club_id
 WHERE f.singleton AND f.visits AND v.club_id=p_club AND v.published AND NOT dm_private.blocked_pair(auth.uid(),c.owner_id));
$$;
CREATE FUNCTION club_private.visit_signal(p_club uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; BEGIN
 FOR a IN SELECT DISTINCT actor FROM (SELECT actor FROM club_private.visit_watchers WHERE club_id=p_club AND touched_at>clock_timestamp()-interval '30 days' UNION SELECT user_id FROM public.club_members WHERE club_id=p_club UNION SELECT applicant FROM club_private.visit_applications WHERE club_id=p_club) q ORDER BY actor LOOP
 PERFORM club_private.chat_signal(a); END LOOP;
END$$;
CREATE FUNCTION club_private.visit_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM club_private.visit_signal(COALESCE(NEW.club_id,OLD.club_id));RETURN NULL;END$$;
CREATE TRIGGER visit_profile_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
CREATE TRIGGER visit_ride_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_rides FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
CREATE TRIGGER visit_application_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_applications FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
CREATE TRIGGER visit_restriction_signal AFTER INSERT OR DELETE ON club_private.visit_restrictions FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
CREATE FUNCTION club_private.visit_flags_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; BEGIN FOR a IN SELECT DISTINCT actor FROM club_private.visit_watchers ORDER BY actor LOOP PERFORM club_private.chat_signal(a); END LOOP;RETURN NULL;END$$;
CREATE TRIGGER visit_flags_signal AFTER UPDATE ON club_private.visit_flags FOR EACH ROW EXECUTE FUNCTION club_private.visit_flags_notify();
CREATE FUNCTION club_private.visit_replay(p_key uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r club_private.visit_intents; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-intent:'||auth.uid()::text,0));
 IF p_key IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM club_private.visit_intents WHERE actor=auth.uid() AND key=p_key;
 IF FOUND THEN IF r.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'CLUB_IDEMPOTENCY_CONFLICT' USING ERRCODE='22023'; END IF; RETURN r.result;END IF;
 RETURN NULL;
END$$;
CREATE FUNCTION club_private.visit_record(p_club uuid,p_key uuid,p_payload jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN INSERT INTO club_private.visit_intents(actor,key,club_id,payload,result) VALUES(auth.uid(),p_key,p_club,p_payload,p_result);RETURN p_result;END$$;
-- Same established content-filter trigger/rules; no text is added to Realtime.
CREATE TRIGGER visit_profile_filter AFTER INSERT OR UPDATE ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.check_content_body();
CREATE TRIGGER visit_ride_filter AFTER INSERT OR UPDATE ON club_private.visit_rides FOR EACH ROW EXECUTE FUNCTION club_private.check_content_body();
CREATE TRIGGER visit_application_filter AFTER INSERT OR UPDATE ON club_private.visit_applications FOR EACH ROW EXECUTE FUNCTION club_private.check_content_body();
COMMIT;
