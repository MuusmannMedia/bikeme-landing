BEGIN;
-- Actor/request IDs remain spent even when their original club is deleted.
-- Erase all retained text/result immediately on club deletion, keep only the hash/key.
ALTER TABLE club_private.visit_intents ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE club_private.visit_intents DROP CONSTRAINT visit_intents_club_id_fkey;
ALTER TABLE club_private.visit_intents ADD CONSTRAINT visit_intents_club_id_fkey FOREIGN KEY(club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;
-- Club deletion must not reset the actor's rolling traffic counters either.
ALTER TABLE club_private.visit_usage DROP CONSTRAINT visit_usage_club_id_fkey;
ALTER TABLE club_private.visit_usage ADD CONSTRAINT visit_usage_club_id_fkey FOREIGN KEY(club_id) REFERENCES public.clubs(id) ON DELETE SET NULL;
CREATE FUNCTION club_private.visit_orphan_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.club_id IS NOT NULL AND NEW.club_id IS NULL THEN NEW.payload:=NULL;NEW.result:=NULL;NEW.compacted_at:=clock_timestamp();END IF;
 RETURN NEW;
END$$;
REVOKE ALL ON FUNCTION club_private.visit_orphan_receipt() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER visit_orphan_receipt BEFORE UPDATE OF club_id ON club_private.visit_intents FOR EACH ROW EXECUTE FUNCTION club_private.visit_orphan_receipt();
COMMIT;
