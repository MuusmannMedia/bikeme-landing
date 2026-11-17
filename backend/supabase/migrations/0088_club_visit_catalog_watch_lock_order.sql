BEGIN;
-- Keep shared advisory locks consistent with existing scalar watch calls.
CREATE OR REPLACE FUNCTION public.club_visit_catalog_manifest(p_ids uuid[],p_known jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET statement_timeout='5s' AS $$
DECLARE a uuid:=club_private.catalog_require();c uuid;result jsonb:='{}';fresh int;allowed uuid[];BEGIN
 IF p_ids IS NULL THEN SELECT COALESCE(array_agg(club_id),'{}'::uuid[]) INTO p_ids FROM (SELECT club_id FROM club_private.visit_pilot WHERE enabled ORDER BY club_id LIMIT 20) q;END IF;
 IF cardinality(p_ids) NOT BETWEEN 0 AND 20 OR array_position(p_ids,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids)x)<>cardinality(p_ids) OR octet_length(COALESCE(p_known,'{}')::text)>16384 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 -- Same order as the existing scalar watch contract: watch lock, then meter.
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-watch:'||a::text,0));
 PERFORM club_private.catalog_meter('manifest');
 SELECT array_agg(x) INTO allowed FROM unnest(p_ids)x WHERE club_private.visit_can_read(x);
 SELECT count(*) INTO fresh FROM unnest(allowed)x LEFT JOIN club_private.visit_watchers w ON w.actor=a AND w.club_id=x WHERE w.actor IS NULL OR w.touched_at<=clock_timestamp()-interval '30 days';
 IF fresh>0 THEN PERFORM club_private.catalog_meter('binding',fresh);END IF;
 INSERT INTO club_private.visit_watchers(actor,club_id) SELECT a,x FROM unnest(allowed)x ON CONFLICT(actor,club_id) DO UPDATE SET touched_at=excluded.touched_at WHERE visit_watchers.touched_at<=clock_timestamp()-interval '5 minutes';
 FOREACH c IN ARRAY p_ids LOOP result:=result||jsonb_build_object(c::text,CASE WHEN c=ANY(allowed) THEN club_private.catalog_profile(c) ELSE NULL END);END LOOP;
 result:=jsonb_build_object('userId',a,'profiles',result,'revision',COALESCE((SELECT revision FROM public.club_visit_catalog_signals WHERE user_id=a),0));
 IF octet_length(result::text)>131072 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;RETURN result;
END$$;
COMMIT;
