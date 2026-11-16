-- TEST project bcskqapoagflshewvzzc only. Follow-up to applied 0047.
BEGIN;
CREATE OR REPLACE FUNCTION public.claim_ride_invite_push(p_actor uuid,p_ride uuid,p_users uuid[],p_send boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.rides; i public.ride_invites; l public.notification_log; u uuid;
  result jsonb:='[]'::jsonb; state text; targets jsonb; invalid_ids uuid[]; claim uuid;
  lang text; club_name text; v_title text; v_body text;
BEGIN
  IF p_actor IS NULL OR cardinality(p_users) IS NULL OR cardinality(p_users)>200 THEN
    RAISE EXCEPTION 'PUSH_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO r FROM public.rides WHERE id=p_ride;
  IF r.id IS NULL OR r.host_id IS DISTINCT FROM p_actor OR r.club_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'PUSH_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF r.club_id IS NOT NULL THEN
    -- A service-role request has no auth.uid(). The actor was verified by
    -- auth.getUser in the Edge Function; this RPC is executable only by service.
    -- Touch exactly the same club row as lock_club, preserving its serialization
    -- and stale-snapshot protection without changing the caller's auth context.
    UPDATE public.clubs SET updated_at=clock_timestamp() WHERE id=r.club_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'PUSH_FORBIDDEN' USING ERRCODE='42501'; END IF;
    SELECT * INTO r FROM public.rides WHERE id=p_ride;
    IF r.club_id IS NULL OR club_private.role_for(r.club_id,p_actor) IS NULL THEN
      RAISE EXCEPTION 'PUSH_FORBIDDEN' USING ERRCODE='42501';
    END IF;
  END IF;
  FOR u IN SELECT DISTINCT x FROM unnest(p_users) x WHERE x IS NOT NULL ORDER BY x LOOP
    SELECT * INTO i FROM public.ride_invites WHERE ride_id=p_ride AND invitee_id=u AND host_id=p_actor;
    IF NOT FOUND OR u=p_actor THEN
      result:=result||jsonb_build_array(jsonb_build_object('user_id',u,'state','skipped')); CONTINUE;
    END IF;
    SELECT * INTO l FROM public.notification_log WHERE notification_type='ride_invite'
      AND dedupe_key=club_private.ride_invite_push_key(p_ride,u,i.created_at) FOR UPDATE;
    IF NOT FOUND THEN
      -- Pre-migration invitations are never retroactively broadcast.
      result:=result||jsonb_build_array(jsonb_build_object('user_id',u,'state','not_queued')); CONTINUE;
    END IF;
    state:=l.metadata->>'push_state'; targets:='[]'::jsonb; claim:=NULL;
    IF l.delivery_claim_id IS NOT NULL THEN
      state:=CASE WHEN l.delivery_claimed_at<clock_timestamp()-interval '40 seconds' THEN 'unknown' ELSE 'pending' END;
    ELSIF p_send AND state IN ('queued','failed','no_token') THEN
      IF r.status<>'ACTIVE' OR r.club_closed_at IS NOT NULL OR r.expires_at<=clock_timestamp()
        OR (r.type='EVENT' AND r.start_time<=clock_timestamp()) OR i.accepted_at IS NOT NULL OR i.declined_at IS NOT NULL
        OR EXISTS(SELECT 1 FROM public.participants WHERE ride_id=p_ride AND user_id=u)
        OR (r.club_id IS NOT NULL AND club_private.role_for(r.club_id,u) IS NULL) THEN state:='skipped';
      ELSIF EXISTS(SELECT 1 FROM public.user_notification_settings WHERE user_id=u AND NOT ride_invites_enabled) THEN state:='disabled';
      ELSE
        SELECT array_agg(id) INTO invalid_ids FROM public.push_tokens WHERE user_id=u AND is_active
          AND expo_project_id='e094a99f-fa6b-4df9-801e-f51886d1d778'::uuid
          AND expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$';
        UPDATE public.push_tokens SET is_active=false WHERE id=ANY(invalid_ids);
        SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'token',expo_push_token) ORDER BY id),'[]'::jsonb)
          INTO targets FROM public.push_tokens WHERE user_id=u AND is_active
          AND expo_project_id='e094a99f-fa6b-4df9-801e-f51886d1d778'::uuid;
        IF jsonb_array_length(targets)=0 THEN state:='no_token';
        ELSE state:='claimed';claim:=gen_random_uuid(); END IF;
      END IF;
      SELECT CASE WHEN raw_user_meta_data->>'language'='da' THEN 'da' ELSE 'en' END INTO lang FROM auth.users WHERE id=u;
      SELECT name INTO club_name FROM public.clubs WHERE id=r.club_id;
      v_title:=CASE WHEN lang='da' THEN 'Turinvitation' ELSE 'Ride invitation' END;
      v_body:=CASE WHEN club_name IS NOT NULL THEN left(club_name,60)||' · ' ELSE '' END||left(coalesce(r.title,''),100);
      UPDATE public.notification_log SET title=v_title,body=v_body,
        status=CASE WHEN state='claimed' THEN 'queued' ELSE 'error' END,
        error=CASE WHEN state='claimed' THEN NULL ELSE state END,
        metadata=metadata||jsonb_build_object('push_state',state,'attempt_at',clock_timestamp(),'language',coalesce(lang,'en')),
        delivery_claim_id=claim,delivery_claimed_at=CASE WHEN claim IS NOT NULL THEN clock_timestamp() END
        WHERE id=l.id RETURNING * INTO l;
    END IF;
    result:=result||jsonb_build_array(jsonb_build_object('user_id',u,'log_id',l.id,'state',state,'claim_id',claim,
      'title',l.title,'body',l.body,'tokens',targets,'metadata',l.metadata));
  END LOOP;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ride_invite_push(uuid,uuid,uuid[],boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ride_invite_push(uuid,uuid,uuid[],boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
