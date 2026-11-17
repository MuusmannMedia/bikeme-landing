BEGIN;
-- Distinguish a short burst boundary from the minute window; thresholds unchanged.
CREATE OR REPLACE FUNCTION club_private.catalog_meter(p_kind text,p_amount bigint DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.require_user();n int;b bigint;burst int;t timestamptz:=clock_timestamp();wait int;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter:'||a::text,0));
 SELECT count(*),COALESCE(sum(amount),0),count(*) FILTER(WHERE at>t-interval '1 second') INTO n,b,burst FROM club_private.catalog_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 minute';
 IF (p_kind='manifest' AND(n>=12 OR burst>=2)) OR(p_kind='media' AND(n>=20 OR burst>=2 OR b+p_amount>10485760)) THEN
  wait:=1;
  IF burst>=2 THEN SELECT GREATEST(1,ceil(extract(epoch FROM min(at)+interval '1.05 seconds'-t))::int) INTO wait FROM club_private.catalog_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 second';END IF;
  IF (p_kind='manifest' AND n>=12) OR(p_kind='media' AND(n>=20 OR b+p_amount>10485760)) THEN
   SELECT GREATEST(wait,ceil(extract(epoch FROM min(at)+interval '61 seconds'-t))::int) INTO wait FROM club_private.catalog_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 minute';
  END IF;
  RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429',DETAIL=jsonb_build_object('retry_after',LEAST(61,COALESCE(wait,61)))::text;
 END IF;
 INSERT INTO club_private.catalog_usage(actor,kind,amount) VALUES(a,p_kind,p_amount);
END$$;
COMMIT;
