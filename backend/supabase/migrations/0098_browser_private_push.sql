-- Add browser transport with the production gate disabled. Preserve the mobile transport.
BEGIN;
DO $$BEGIN IF to_regprocedure('public.dm_mark_read(uuid,uuid[])') IS NULL OR to_regprocedure('public.dm_push_open(uuid,uuid)') IS NULL OR to_regprocedure('dm_private.push_allowed(dm_private.push_jobs)') IS NULL OR to_regprocedure('public.message_react(text,uuid,uuid,text,uuid)') IS NULL THEN RAISE EXCEPTION 'WEB_PUSH_SHARED_FOUNDATION_MISSING';END IF;END $$;
CREATE TABLE dm_private.web_push_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,recipient_allowlist uuid[] DEFAULT '{}',worker_url text CHECK(worker_url IS NULL OR worker_url='https://zawilafvdwlnwsdeufts.supabase.co/functions/v1/notify_browser_message'));
INSERT INTO dm_private.web_push_config DEFAULT VALUES;
-- Empty by default: activation must explicitly select browser test recipients.
-- NULL is a separate, deliberate broad rollout; mobile flags are independent.
CREATE FUNCTION dm_private.web_push_enabled(p_user uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT enabled AND (recipient_allowlist IS NULL OR p_user=ANY(recipient_allowlist)) FROM dm_private.web_push_config WHERE id;
$$;
REVOKE ALL ON FUNCTION dm_private.web_push_enabled(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.web_push_status() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT coalesce(dm_private.web_push_enabled(dm_private.uid()),false); $$;
REVOKE ALL ON FUNCTION public.web_push_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.web_push_status() TO authenticated;
CREATE TABLE dm_private.web_push_subscriptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 binding text NOT NULL UNIQUE CHECK(binding ~ '^[a-f0-9]{64}$'),endpoint text NOT NULL UNIQUE,
 p256dh text NOT NULL,auth text NOT NULL,language text NOT NULL CHECK(language IN('da','en','de','es','it','fr','nl')),
 enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '30 days');
CREATE TABLE dm_private.web_push_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message_id uuid NOT NULL REFERENCES dm_private.push_jobs(message_id) ON DELETE CASCADE,
 subscription_id uuid NOT NULL REFERENCES dm_private.web_push_subscriptions(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN('queued','claimed','accepted','retry','error','unknown','skipped')),
 attempts integer NOT NULL DEFAULT 0,next_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),claim uuid,claimed_at timestamptz,UNIQUE(message_id,subscription_id));
CREATE INDEX web_push_due ON dm_private.web_push_deliveries(next_at) WHERE state IN('queued','retry');
ALTER TABLE dm_private.web_push_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.web_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dm_private.web_push_config,dm_private.web_push_subscriptions,dm_private.web_push_deliveries FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.web_push_register(p_binding text,p_endpoint text,p_p256dh text,p_auth text,p_language text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();s dm_private.web_push_subscriptions;v uuid;
BEGIN
 IF NOT dm_private.web_push_enabled(u) THEN RAISE EXCEPTION 'WEB_PUSH_DISABLED' USING ERRCODE='P0002';END IF;
 IF p_binding!~'^[a-f0-9]{64}$' OR length(p_endpoint)>2048 OR p_endpoint!~'^https://(fcm[.]googleapis[.]com/fcm/send/|updates[.]push[.]services[.]mozilla[.]com/wpush/|web[.]push[.]apple[.]com/)[A-Za-z0-9_/?=&%+:.-]+$' OR p_p256dh!~'^[A-Za-z0-9_-]{86,88}={0,2}$' OR p_auth!~'^[A-Za-z0-9_-]{22,24}={0,2}$' OR p_language NOT IN('da','en','de','es','it','fr','nl') THEN RAISE EXCEPTION 'WEB_PUSH_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('web-push:'||u,0));
 SELECT * INTO s FROM dm_private.web_push_subscriptions WHERE binding=p_binding FOR UPDATE;
 IF s.id IS NOT NULL AND s.user_id<>u THEN RAISE EXCEPTION 'WEB_PUSH_OWNER' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM dm_private.web_push_subscriptions WHERE endpoint=p_endpoint AND binding<>p_binding) THEN RAISE EXCEPTION 'WEB_PUSH_OWNER' USING ERRCODE='42501';END IF;
 -- Renewal of unchanged keys is idempotent, never binds a different user or backfills history.
 IF s.id IS NOT NULL AND s.endpoint=p_endpoint AND s.p256dh=p_p256dh AND s.auth=p_auth THEN
 UPDATE dm_private.web_push_subscriptions SET enabled=true,language=p_language,expires_at=clock_timestamp()+interval '30 days' WHERE id=s.id;RETURN s.id;END IF;
 IF EXISTS(SELECT 1 FROM dm_private.web_push_subscriptions WHERE user_id=u AND updated_at>clock_timestamp()-interval '1 minute') OR (s.id IS NULL AND (SELECT count(*) FROM dm_private.web_push_subscriptions WHERE user_id=u AND enabled AND expires_at>clock_timestamp())>=3) THEN RAISE EXCEPTION 'WEB_PUSH_LIMIT' USING ERRCODE='PT429';END IF;
 INSERT INTO dm_private.web_push_subscriptions(user_id,binding,endpoint,p256dh,auth,language) VALUES(u,p_binding,p_endpoint,p_p256dh,p_auth,p_language)
 ON CONFLICT(binding) DO UPDATE SET endpoint=EXCLUDED.endpoint,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth,language=EXCLUDED.language,enabled=true,updated_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' RETURNING id INTO v;RETURN v;
END $$;
CREATE FUNCTION public.web_push_remove(p_binding text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN DELETE FROM dm_private.web_push_subscriptions WHERE binding=p_binding AND user_id=dm_private.uid();END $$;
CREATE TABLE dm_private.web_push_wakeups(nonce uuid PRIMARY KEY,issued bigint NOT NULL,used boolean NOT NULL DEFAULT false);
ALTER TABLE dm_private.web_push_wakeups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dm_private.web_push_wakeups FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.web_push_consume(p_nonce uuid,p_issued bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF abs(extract(epoch FROM clock_timestamp())-p_issued)>120 THEN RETURN false;END IF;
UPDATE dm_private.web_push_wakeups SET used=true WHERE nonce=p_nonce AND issued=p_issued AND NOT used;RETURN FOUND;END $$;
REVOKE ALL ON FUNCTION public.web_push_consume(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_consume(uuid,bigint) TO service_role;
CREATE FUNCTION dm_private.web_push_dispatch() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE secret text;target text;n uuid:=gen_random_uuid();issued bigint:=extract(epoch FROM clock_timestamp())::bigint;signature text;
BEGIN
SELECT worker_url INTO target FROM dm_private.web_push_config WHERE enabled;IF target IS NULL THEN RETURN;END IF;
SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='web_push_worker_secret' LIMIT 1;IF secret IS NULL THEN RETURN;END IF;
INSERT INTO dm_private.web_push_wakeups(nonce,issued) VALUES(n,issued);
signature:=encode(extensions.hmac(issued::text||'.'||n::text,secret,'sha256'),'hex');
PERFORM net.http_post(url:=target,headers:=jsonb_build_object('Content-Type','application/json','x-web-push-time',issued::text,'x-web-push-nonce',n::text,'x-web-push-signature',signature),body:='{}'::jsonb,timeout_milliseconds:=5000);
END $$;
REVOKE ALL ON FUNCTION dm_private.web_push_dispatch() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION dm_private.web_push_queue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF (SELECT enabled FROM dm_private.web_push_config) THEN
 INSERT INTO dm_private.web_push_deliveries(message_id,subscription_id)
 SELECT j.message_id,s.id FROM dm_private.push_jobs j JOIN dm_private.web_push_subscriptions s ON s.user_id=j.recipient_id
 WHERE j.message_id=NEW.id AND dm_private.web_push_enabled(s.user_id) AND s.enabled AND s.expires_at>clock_timestamp() AND dm_private.push_allowed(j)
 ON CONFLICT DO NOTHING;
 BEGIN PERFORM dm_private.web_push_dispatch();EXCEPTION WHEN OTHERS THEN NULL;END;
 END IF;RETURN NEW;
END $$;
-- Alphabetical order after dm_message_push; never scans/reenqueues old messages.
CREATE TRIGGER web_message_push AFTER INSERT ON dm_private.messages FOR EACH ROW EXECUTE FUNCTION dm_private.web_push_queue();
CREATE FUNCTION public.web_push_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d dm_private.web_push_deliveries;v uuid;answer jsonb:='[]';
BEGIN
 IF NOT (SELECT enabled FROM dm_private.web_push_config) OR NOT pg_try_advisory_xact_lock(hashtextextended('dm_private.web_push_claim',0)) THEN RETURN answer;END IF;
 UPDATE dm_private.web_push_deliveries SET state='unknown' WHERE state='claimed' AND claimed_at<clock_timestamp()-interval '2 minutes';
 FOR d IN SELECT candidate.* FROM dm_private.web_push_deliveries candidate WHERE candidate.state IN('queued','retry') AND EXISTS(SELECT 1 FROM dm_private.web_push_subscriptions s WHERE s.id=candidate.subscription_id AND dm_private.web_push_enabled(s.user_id)) AND candidate.attempts<3 AND candidate.next_at<=clock_timestamp() ORDER BY candidate.next_at LIMIT 4 FOR UPDATE SKIP LOCKED LOOP
 v:=gen_random_uuid();UPDATE dm_private.web_push_deliveries SET state='claimed',claim=v,claimed_at=clock_timestamp(),attempts=attempts+1 WHERE id=d.id;
 answer:=answer||jsonb_build_array(jsonb_build_object('id',d.id,'claim',v));END LOOP;RETURN answer;
END $$;
CREATE FUNCTION public.web_push_payload(p_delivery uuid,p_claim uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d dm_private.web_push_deliveries;j dm_private.push_jobs;s dm_private.web_push_subscriptions;body text;
BEGIN
 SELECT * INTO d FROM dm_private.web_push_deliveries WHERE id=p_delivery;
 IF d.state IS DISTINCT FROM 'claimed' OR d.claim IS DISTINCT FROM p_claim THEN RETURN NULL;END IF;
 SELECT * INTO j FROM dm_private.push_jobs WHERE message_id=d.message_id;
 UPDATE dm_private.conversations SET guard_version=guard_version+1 WHERE id=j.conversation_id;
 SELECT * INTO d FROM dm_private.web_push_deliveries WHERE id=p_delivery FOR UPDATE;
 SELECT * INTO s FROM dm_private.web_push_subscriptions WHERE id=d.subscription_id;
 IF d.state IS DISTINCT FROM 'claimed' OR d.claim IS DISTINCT FROM p_claim OR NOT dm_private.web_push_enabled(j.recipient_id) OR NOT dm_private.push_allowed(j) OR s.user_id IS DISTINCT FROM j.recipient_id OR NOT coalesce(s.enabled,false) OR s.expires_at<=clock_timestamp() OR d.created_at<clock_timestamp()-interval '1 day' THEN
 UPDATE dm_private.web_push_deliveries SET state='skipped' WHERE id=d.id;RETURN NULL;END IF;
 IF (SELECT preview_enabled FROM dm_private.push_config) THEN SELECT m.body INTO body FROM dm_private.messages m WHERE m.id=j.message_id AND m.deleted_at IS NULL;END IF;
 RETURN jsonb_build_object('subscription',s.id,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'language',s.language,'recipient',j.recipient_id,'conversation',j.conversation_id,'message',j.message_id,'body',body);
END $$;
CREATE FUNCTION public.web_push_finish(p_delivery uuid,p_claim uuid,p_state text,p_wait integer DEFAULT 60) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d dm_private.web_push_deliveries;
BEGIN
 IF p_state NOT IN('accepted','retry','error','unknown','expired') THEN RAISE EXCEPTION 'WEB_PUSH_INVALID';END IF;
 SELECT * INTO d FROM dm_private.web_push_deliveries WHERE id=p_delivery FOR UPDATE;
 IF d.state IS DISTINCT FROM 'claimed' OR d.claim IS DISTINCT FROM p_claim THEN RETURN;END IF;
 UPDATE dm_private.web_push_deliveries SET state=CASE WHEN p_state='expired' THEN 'error' WHEN p_state='retry' AND attempts>=3 THEN 'error' ELSE p_state END,next_at=clock_timestamp()+make_interval(secs=>greatest(30,least(86400,p_wait))) WHERE id=d.id;
 IF p_state='expired' THEN DELETE FROM dm_private.web_push_subscriptions WHERE id=d.subscription_id;END IF;
END $$;
-- SW rechecks current cookie owner, binding, message and subscription immediately before display.
CREATE FUNCTION public.web_push_authorize(p_subscription uuid,p_binding text,p_conversation uuid,p_message uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();body text;
BEGIN
 IF NOT dm_private.web_push_enabled(u) OR NOT EXISTS(SELECT 1 FROM dm_private.web_push_subscriptions WHERE id=p_subscription AND binding=p_binding AND user_id=u AND enabled AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'WEB_PUSH_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM public.dm_push_open(p_conversation,p_message);
 IF NOT EXISTS(SELECT 1 FROM dm_private.web_push_deliveries d JOIN dm_private.push_jobs j ON j.message_id=d.message_id WHERE d.subscription_id=p_subscription AND d.message_id=p_message AND d.state IN('claimed','accepted') AND dm_private.push_allowed(j)) THEN RAISE EXCEPTION 'WEB_PUSH_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF (SELECT preview_enabled FROM dm_private.push_config) THEN SELECT m.body INTO body FROM dm_private.messages m WHERE m.id=p_message AND m.conversation_id=p_conversation;END IF;
 RETURN jsonb_build_object('body',body);
END $$;
CREATE FUNCTION public.web_push_maintenance() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN DELETE FROM dm_private.web_push_wakeups WHERE issued<extract(epoch FROM clock_timestamp()-interval '10 minutes');DELETE FROM dm_private.web_push_subscriptions WHERE expires_at<clock_timestamp();DELETE FROM dm_private.web_push_deliveries WHERE created_at<clock_timestamp()-interval '7 days';END $$;
REVOKE ALL ON FUNCTION public.web_push_register(text,text,text,text,text),public.web_push_remove(text),public.web_push_authorize(uuid,text,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.web_push_register(text,text,text,text,text),public.web_push_remove(text),public.web_push_authorize(uuid,text,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION dm_private.web_push_queue() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.web_push_claim(),public.web_push_payload(uuid,uuid),public.web_push_finish(uuid,uuid,text,integer),public.web_push_maintenance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.web_push_claim(),public.web_push_payload(uuid,uuid),public.web_push_finish(uuid,uuid,text,integer),public.web_push_maintenance() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
