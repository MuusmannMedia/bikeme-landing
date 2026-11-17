BEGIN;
-- Consistent actor ordering for shared signal row locks during concurrent mutations.
CREATE OR REPLACE FUNCTION club_private.catalog_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid;c uuid;b uuid;d uuid;member_actor uuid;BEGIN
 IF TG_TABLE_NAME IN('visit_flags','catalog_config') THEN
  FOR a IN SELECT DISTINCT actor FROM club_private.visit_watchers ORDER BY actor LOOP PERFORM club_private.catalog_signal(a);END LOOP;
 ELSIF TG_TABLE_NAME='blocks' THEN
  b:=COALESCE(NEW.blocker,OLD.blocker);d:=COALESCE(NEW.blocked,OLD.blocked);
  FOR a IN SELECT DISTINCT x FROM unnest(ARRAY[b,d])x ORDER BY x LOOP PERFORM club_private.catalog_signal(a);END LOOP;
 ELSE
  c:=COALESCE(to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='clubs' THEN 'id' ELSE 'club_id' END,to_jsonb(OLD)->>CASE WHEN TG_TABLE_NAME='clubs' THEN 'id' ELSE 'club_id' END)::uuid;
  IF TG_TABLE_NAME='club_members' THEN
   member_actor:=COALESCE(NEW.user_id,OLD.user_id);
   IF NOT EXISTS(SELECT 1 FROM club_private.visit_profiles WHERE club_id=c AND show_member_count) THEN PERFORM club_private.catalog_signal(member_actor);RETURN NULL;END IF;
  END IF;
  FOR a IN SELECT DISTINCT actor FROM club_private.visit_watchers WHERE club_id=c AND touched_at>clock_timestamp()-interval '30 days' UNION SELECT member_actor WHERE member_actor IS NOT NULL ORDER BY actor LOOP PERFORM club_private.catalog_signal(a);END LOOP;
 END IF;RETURN NULL;
END$$;
COMMIT;
