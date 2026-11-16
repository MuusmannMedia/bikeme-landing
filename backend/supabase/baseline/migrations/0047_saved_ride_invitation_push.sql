-- Separate application: bcskqapoagflshewvzzc (Bike Me Clubs TEST) only.
-- Verify 0043-0046 and the target before applying; never use a combined push.
BEGIN;

ALTER TABLE public.user_notification_settings
  ADD COLUMN ride_invites_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_tokens ADD COLUMN expo_project_id uuid;

-- Keep the four-argument legacy RPC. New clients must explicitly bind the token
-- to this test EAS project; unscoped legacy tokens are not delivery targets.
CREATE FUNCTION public.upsert_push_token(p_expo_push_token text, p_platform text,
  p_device_id text, p_last_seen_at timestamptz, p_expo_project_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR p_expo_project_id IS DISTINCT FROM 'e094a99f-fa6b-4df9-801e-f51886d1d778'::uuid
    OR p_expo_push_token IS NULL OR btrim(p_expo_push_token) !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' THEN
    RAISE EXCEPTION 'PUSH_TOKEN_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.push_tokens(user_id,expo_push_token,platform,device_id,is_active,last_seen_at,expo_project_id)
    VALUES(auth.uid(),btrim(p_expo_push_token),p_platform,p_device_id,true,clock_timestamp(),p_expo_project_id)
    ON CONFLICT(expo_push_token) DO UPDATE SET user_id=EXCLUDED.user_id,platform=EXCLUDED.platform,
      device_id=EXCLUDED.device_id,is_active=true,last_seen_at=EXCLUDED.last_seen_at,expo_project_id=EXCLUDED.expo_project_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_push_token(text,text,text,timestamptz,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(text,text,text,timestamptz,uuid) TO authenticated;

CREATE FUNCTION club_private.ride_invite_push_key(p_ride uuid,p_user uuid,p_created timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT 'ride_invite:'||p_ride::text||':'||p_user::text||':'||extract(epoch FROM p_created)::text;
$$;

CREATE FUNCTION club_private.queue_saved_ride_invite_push() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.accepted_at IS NULL AND NEW.declined_at IS NULL THEN
    INSERT INTO public.notification_log(ride_id,sender_user_id,recipient_user_id,title,body,status,notification_type,dedupe_key,metadata)
    VALUES(NEW.ride_id,NEW.host_id,NEW.invitee_id,'Ride invitation','','queued','ride_invite',
      club_private.ride_invite_push_key(NEW.ride_id,NEW.invitee_id,NEW.created_at),
      jsonb_build_object('push_state','queued','invite_created_at',NEW.created_at,'tickets','[]'::jsonb))
    ON CONFLICT(dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER queue_saved_ride_invite_push AFTER INSERT ON public.ride_invites
  FOR EACH ROW EXECUTE FUNCTION club_private.queue_saved_ride_invite_push();
REVOKE ALL ON FUNCTION club_private.ride_invite_push_key(uuid,uuid,timestamptz),club_private.queue_saved_ride_invite_push()
  FROM PUBLIC,anon,authenticated;

-- Service-only claim. The Edge Function supplies the actor after auth.getUser.
-- The same club lock as invitation/member actions is the eligibility boundary.
CREATE FUNCTION public.claim_ride_invite_push(p_actor uuid,p_ride uuid,p_users uuid[],p_send boolean DEFAULT true)
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
    PERFORM club_private.lock_club(r.club_id);
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

CREATE FUNCTION public.finish_ride_invite_push(p_log uuid,p_claim uuid,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l public.notification_log; state text:=p_result->>'push_state';
BEGIN
  IF state IS NULL OR state NOT IN ('accepted','failed','unknown') THEN RAISE EXCEPTION 'PUSH_INVALID_RESULT'; END IF;
  SELECT * INTO l FROM public.notification_log WHERE id=p_log AND notification_type='ride_invite' FOR UPDATE;
  IF l.id IS NULL OR l.delivery_claim_id IS DISTINCT FROM p_claim OR p_claim IS NULL THEN
    RAISE EXCEPTION 'PUSH_CLAIM_CONFLICT' USING ERRCODE='40001';
  END IF;
  UPDATE public.push_tokens SET is_active=false WHERE user_id=l.recipient_user_id
    AND expo_project_id='e094a99f-fa6b-4df9-801e-f51886d1d778'::uuid
    AND id IN (SELECT (x->>'token_id')::uuid FROM jsonb_array_elements(coalesce(p_result->'tickets','[]'::jsonb)) x
      WHERE x->>'error'='DeviceNotRegistered');
  UPDATE public.notification_log SET metadata=metadata||p_result,
    status=CASE WHEN state='accepted' THEN 'sent' ELSE 'error' END,
    error=CASE WHEN state='accepted' THEN NULL ELSE coalesce(p_result->>'error',state) END,
    delivery_claim_id=CASE WHEN state='unknown' THEN delivery_claim_id END,
    delivery_claimed_at=CASE WHEN state='unknown' THEN delivery_claimed_at END
    WHERE id=l.id;
END;
$$;

CREATE FUNCTION public.record_ride_invite_receipts(p_log uuid,p_receipts jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE l public.notification_log; tickets jsonb:='[]'::jsonb; t jsonb; receipt jsonb; failure text;
BEGIN
  SELECT * INTO l FROM public.notification_log WHERE id=p_log AND notification_type='ride_invite' FOR UPDATE;
  IF l.id IS NULL THEN RETURN; END IF;
  FOR t IN SELECT value FROM jsonb_array_elements(coalesce(l.metadata->'tickets','[]'::jsonb)) LOOP
    receipt:=p_receipts->(t->>'ticket_id');
    IF t->>'status'='ok' AND receipt->>'status' IN ('ok','error','unknown') THEN
      t:=t||jsonb_build_object('receipt',receipt,'receipt_checked_at',clock_timestamp());
      IF receipt->>'error'='DeviceNotRegistered' THEN
        UPDATE public.push_tokens SET is_active=false WHERE id=(t->>'token_id')::uuid
          AND user_id=l.recipient_user_id AND expo_project_id='e094a99f-fa6b-4df9-801e-f51886d1d778'::uuid;
      END IF;
      IF receipt->>'status'='error' THEN failure:=coalesce(receipt->>'error','receipt_error'); END IF;
    END IF;
    tickets:=tickets||jsonb_build_array(t);
  END LOOP;
  UPDATE public.notification_log SET metadata=metadata||jsonb_build_object('tickets',tickets,'receipts_checked_at',clock_timestamp()),
    status=CASE WHEN failure IS NOT NULL THEN 'error' ELSE status END,error=coalesce(failure,error) WHERE id=l.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ride_invite_push(uuid,uuid,uuid[],boolean),
  public.finish_ride_invite_push(uuid,uuid,jsonb),public.record_ride_invite_receipts(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ride_invite_push(uuid,uuid,uuid[],boolean),
  public.finish_ride_invite_push(uuid,uuid,jsonb),public.record_ride_invite_receipts(uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
