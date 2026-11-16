-- Apply separately to bcskqapoagflshewvzzc (Bike Me Klubber TEST) only.
BEGIN;
CREATE TABLE public.club_posts (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), edited_at timestamptz,
 version integer NOT NULL DEFAULT 1, is_pinned boolean NOT NULL DEFAULT false,
 deleted_at timestamptz, deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 UNIQUE(club_id,id), CHECK(version>0),
 CHECK((deleted_at IS NULL AND char_length(btrim(body)) BETWEEN 1 AND 4000) OR (deleted_at IS NOT NULL AND body=''))
);
CREATE INDEX club_posts_page_idx ON public.club_posts(club_id,is_pinned DESC,created_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE TABLE public.club_comments (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 post_id uuid NOT NULL, author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), edited_at timestamptz,
 version integer NOT NULL DEFAULT 1, deleted_at timestamptz, deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 FOREIGN KEY(club_id,post_id) REFERENCES public.club_posts(club_id,id) ON DELETE CASCADE,
 CHECK(version>0), CHECK((deleted_at IS NULL AND char_length(btrim(body)) BETWEEN 1 AND 1500) OR (deleted_at IS NOT NULL AND body=''))
);
CREATE INDEX club_comments_page_idx ON public.club_comments(club_id,post_id,created_at,id) WHERE deleted_at IS NULL;
-- Reports/audit are not exposed tables. Even moderators receive no reporter ID.
CREATE TABLE club_private.content_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
 comment_id uuid REFERENCES public.club_comments(id) ON DELETE CASCADE,
 reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, target_kind text NOT NULL CHECK(target_kind IN ('post','comment')),
 target_id uuid NOT NULL, reason text NOT NULL CHECK(reason IN ('spam','harassment','unsafe','other')),
 detail text NOT NULL DEFAULT '' CHECK(char_length(detail)<=500), snapshot jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','removed','dismissed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz,
 moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 UNIQUE(club_id,target_kind,target_id,reporter_id),
 CHECK((status='pending' AND resolved_at IS NULL AND moderator_id IS NULL) OR (status<>'pending' AND resolved_at IS NOT NULL))
);
CREATE INDEX content_reports_page_idx ON club_private.content_reports(club_id,status,created_at DESC,id DESC);
CREATE TABLE club_private.content_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, target_kind text NOT NULL, target_id uuid NOT NULL,
 action text NOT NULL, report_id uuid REFERENCES club_private.content_reports(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.club_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.content_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_posts,public.club_comments,club_private.content_reports,club_private.content_actions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.club_posts,public.club_comments TO authenticated,service_role;
CREATE POLICY club_posts_member_read ON public.club_posts FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND club_private.my_role(club_id) IS NOT NULL);
CREATE POLICY club_comments_member_read ON public.club_comments FOR SELECT TO authenticated
 USING(deleted_at IS NULL AND club_private.my_role(club_id) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.club_posts p WHERE p.id=post_id AND p.club_id=club_comments.club_id AND p.deleted_at IS NULL));

CREATE FUNCTION club_private.content_member(p_club uuid,p_write boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.require_user();
BEGIN
 IF p_write THEN PERFORM club_private.lock_club(p_club); END IF;
 IF club_private.role_for(p_club,u) IS NULL THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN u;
END; $$;
CREATE FUNCTION club_private.content_json(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('kind','post','id',p.id,'club_id',p.club_id,'post_id',p.id,'author_id',p.author_id,
 'display_name',a.display_name,'avatar_url',a.avatar_url,'body',p.body,'created_at',p.created_at,'edited_at',p.edited_at,
 'version',p.version,'is_pinned',p.is_pinned,'comment_count',(SELECT count(*) FROM public.club_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL))
 FROM public.club_posts p LEFT JOIN public.profiles a ON a.id=p.author_id WHERE p_kind='post' AND p.id=p_id AND p.deleted_at IS NULL
 UNION ALL
 SELECT jsonb_build_object('kind','comment','id',c.id,'club_id',c.club_id,'post_id',c.post_id,'author_id',c.author_id,
 'display_name',a.display_name,'avatar_url',a.avatar_url,'body',c.body,'created_at',c.created_at,'edited_at',c.edited_at,
 'version',c.version,'is_pinned',false,'comment_count',0)
 FROM public.club_comments c JOIN public.club_posts p ON p.id=c.post_id LEFT JOIN public.profiles a ON a.id=c.author_id
 WHERE p_kind='comment' AND c.id=p_id AND c.deleted_at IS NULL AND p.deleted_at IS NULL;
$$;
CREATE FUNCTION public.club_posts_page(p_club uuid,p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,
 p_before_pinned boolean DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); items jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_before_time,p_before_id,p_before_pinned) NOT IN (0,3) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(club_private.content_json('post',q.id) ORDER BY q.is_pinned DESC,q.created_at DESC,q.id DESC),'[]') INTO items
 FROM (SELECT p.* FROM public.club_posts p WHERE p.club_id=p_club AND p.deleted_at IS NULL AND
 (p_before_id IS NULL OR (p.is_pinned,p.created_at,p.id)<(p_before_pinned,p_before_time,p_before_id))
 ORDER BY p.is_pinned DESC,p.created_at DESC,p.id DESC LIMIT p_limit) q;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'items',items);
END; $$;
CREATE FUNCTION public.club_post_thread(p_club uuid,p_post uuid,p_after_time timestamptz DEFAULT NULL,
 p_after_id uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); item jsonb; comments jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_after_time,p_after_id) NOT IN (0,2) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT club_private.content_json('post',id) INTO item FROM public.club_posts WHERE id=p_post AND club_id=p_club AND deleted_at IS NULL;
 IF item IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_agg(club_private.content_json('comment',q.id) ORDER BY q.created_at,q.id),'[]') INTO comments
 FROM (SELECT c.* FROM public.club_comments c WHERE c.club_id=p_club AND c.post_id=p_post AND c.deleted_at IS NULL
 AND (p_after_id IS NULL OR (c.created_at,c.id)>(p_after_time,p_after_id)) ORDER BY c.created_at,c.id LIMIT p_limit) q;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'post',item,'items',comments);
END; $$;
CREATE FUNCTION public.club_content_item(p_club uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); item jsonb:=club_private.content_json(p_kind,p_id);
BEGIN
 IF item IS NULL OR item->>'club_id' IS DISTINCT FROM p_club::text THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN item;
END; $$;
CREATE FUNCTION public.club_content_create(p_club uuid,p_id uuid,p_body text,p_post uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); existing_author uuid; existing_club uuid; existing_post uuid;
 v integer; removed timestamptz; max_len integer:=CASE WHEN p_post IS NULL THEN 4000 ELSE 1500 END;
BEGIN
 IF p_id IS NULL OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND max_len THEN
 RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF p_post IS NULL THEN
  INSERT INTO public.club_posts(id,club_id,author_id,body) VALUES(p_id,p_club,u,btrim(p_body)) ON CONFLICT(id) DO NOTHING;
  SELECT author_id,club_id,version,deleted_at INTO existing_author,existing_club,v,removed FROM public.club_posts WHERE id=p_id;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM public.club_posts WHERE id=p_post AND club_id=p_club AND deleted_at IS NULL) THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  INSERT INTO public.club_comments(id,club_id,post_id,author_id,body) VALUES(p_id,p_club,p_post,u,btrim(p_body)) ON CONFLICT(id) DO NOTHING;
  SELECT author_id,club_id,post_id,version,deleted_at INTO existing_author,existing_club,existing_post,v,removed FROM public.club_comments WHERE id=p_id;
  IF existing_post IS DISTINCT FROM p_post THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 END IF;
 IF existing_author IS DISTINCT FROM u OR existing_club IS DISTINCT FROM p_club THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('id',p_id,'version',v);
END; $$;
CREATE FUNCTION public.club_content_change(p_club uuid,p_kind text,p_id uuid,p_action text,
 p_body text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); item jsonb; author uuid; v integer; removed timestamptz;
 is_mod boolean:=club_private.role_for(p_club,u) IN ('owner','admin'); old_body text; pinned boolean; parent uuid;
BEGIN
 IF p_kind='post' THEN
  SELECT author_id,version,deleted_at,body,is_pinned,id INTO author,v,removed,old_body,pinned,parent FROM public.club_posts WHERE id=p_id AND club_id=p_club;
 ELSIF p_kind='comment' THEN
  SELECT c.author_id,c.version,c.deleted_at,c.body,c.post_id INTO author,v,removed,old_body,parent FROM public.club_comments c
  JOIN public.club_posts p ON p.id=c.post_id WHERE c.id=p_id AND c.club_id=p_club AND p.deleted_at IS NULL;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF v IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_action='edit' THEN
  IF author IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND (CASE WHEN p_kind='post' THEN 4000 ELSE 1500 END) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
  IF v=p_version+1 AND old_body=btrim(p_body) THEN RETURN jsonb_build_object('id',p_id,'version',v); END IF;
  IF p_version IS DISTINCT FROM v THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='40001'; END IF;
  IF p_kind='post' THEN UPDATE public.club_posts SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
  ELSE UPDATE public.club_comments SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id; END IF;
 ELSIF p_action IN ('pin','unpin') THEN
  IF NOT is_mod OR p_kind<>'post' THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF pinned IS DISTINCT FROM (p_action='pin') THEN
   UPDATE public.club_posts SET is_pinned=(p_action='pin'),version=version+1 WHERE id=p_id;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,p_action);
  END IF;
 ELSIF p_action='delete' THEN
  IF author IS DISTINCT FROM u AND NOT is_mod THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NULL THEN
   IF p_kind='post' THEN
    UPDATE public.club_posts SET body='',deleted_at=clock_timestamp(),deleted_by=u,is_pinned=false,version=version+1 WHERE id=p_id;
    UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE post_id=p_id AND deleted_at IS NULL;
   ELSE UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE id=p_id; END IF;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,CASE WHEN author=u THEN 'author_delete' ELSE 'moderator_remove' END);
  END IF;
  IF is_mod THEN UPDATE club_private.content_reports SET status='removed',resolved_at=clock_timestamp(),moderator_id=u
   WHERE club_id=p_club AND status='pending' AND (target_id=p_id OR (p_kind='post' AND post_id=p_id)); END IF;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $$;
CREATE FUNCTION public.club_content_report(p_club uuid,p_kind text,p_id uuid,p_reason text,p_detail text DEFAULT '') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); item jsonb; report_id uuid;
BEGIN
 IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','unsafe','other') OR char_length(coalesce(p_detail,''))>500 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT id INTO report_id FROM club_private.content_reports WHERE club_id=p_club AND target_kind=p_kind AND target_id=p_id AND reporter_id=u;
 IF report_id IS NOT NULL THEN RETURN report_id; END IF;
 item:=club_private.content_json(p_kind,p_id);
 IF item IS NULL OR item->>'club_id' IS DISTINCT FROM p_club::text THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 INSERT INTO club_private.content_reports(club_id,post_id,comment_id,reporter_id,target_kind,target_id,reason,detail,snapshot)
 VALUES(p_club,(item->>'post_id')::uuid,CASE WHEN p_kind='comment' THEN p_id END,u,p_kind,p_id,p_reason,btrim(coalesce(p_detail,'')),item) RETURNING id INTO report_id;
 RETURN report_id;
END; $$;
CREATE FUNCTION club_private.content_report_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',id,'club_id',club_id,'post_id',post_id,'target_kind',target_kind,'target_id',target_id,
 'reason',reason,'detail',detail,'status',status,'created_at',created_at,'resolved_at',resolved_at,
 'snapshot',snapshot,'content',club_private.content_json(target_kind,target_id)) FROM club_private.content_reports WHERE id=p_id;
$$;
CREATE FUNCTION public.club_content_reports_page(p_club uuid,p_closed boolean DEFAULT false,p_before_time timestamptz DEFAULT NULL,
 p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); items jsonb;
BEGIN
 IF club_private.role_for(p_club,u) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_before_time,p_before_id) NOT IN (0,2) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(club_private.content_report_json(q.id) ORDER BY q.created_at DESC,q.id DESC),'[]') INTO items
 FROM (SELECT r.* FROM club_private.content_reports r WHERE r.club_id=p_club AND (r.status<>'pending')=p_closed
 AND (p_before_id IS NULL OR (r.created_at,r.id)<(p_before_time,p_before_id)) ORDER BY r.created_at DESC,r.id DESC LIMIT p_limit) q;
 RETURN jsonb_build_object('items',items);
END; $$;
CREATE FUNCTION public.club_content_resolve(p_club uuid,p_report uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); r club_private.content_reports;
BEGIN
 IF club_private.role_for(p_club,u) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('remove','dismiss') THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM club_private.content_reports WHERE id=p_report AND club_id=p_club;
 IF r.id IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF r.status<>'pending' THEN RETURN jsonb_build_object('id',r.id,'status',r.status,'already_handled',true); END IF;
 IF p_action='remove' AND club_private.content_json(r.target_kind,r.target_id) IS NOT NULL THEN
  PERFORM public.club_content_change(p_club,r.target_kind,r.target_id,'delete');
 END IF;
 UPDATE club_private.content_reports SET status=CASE WHEN p_action='remove' THEN 'removed' ELSE 'dismissed' END,
 resolved_at=clock_timestamp(),moderator_id=u WHERE id=p_report;
 INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action,report_id)
 VALUES(p_club,u,r.target_kind,r.target_id,'report_'||p_action,p_report);
 RETURN jsonb_build_object('id',r.id,'status',CASE WHEN p_action='remove' THEN 'removed' ELSE 'dismissed' END,'already_handled',false);
END; $$;
REVOKE ALL ON FUNCTION club_private.content_member(uuid,boolean),club_private.content_json(text,uuid),club_private.content_report_json(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.club_posts_page(uuid,timestamptz,uuid,boolean,integer),public.club_post_thread(uuid,uuid,timestamptz,uuid,integer),
 public.club_content_item(uuid,text,uuid),public.club_content_create(uuid,uuid,text,uuid),public.club_content_change(uuid,text,uuid,text,text,integer),public.club_content_report(uuid,text,uuid,text,text),
 public.club_content_reports_page(uuid,boolean,timestamptz,uuid,integer),public.club_content_resolve(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_posts_page(uuid,timestamptz,uuid,boolean,integer),public.club_post_thread(uuid,uuid,timestamptz,uuid,integer),
 public.club_content_item(uuid,text,uuid),public.club_content_create(uuid,uuid,text,uuid),public.club_content_change(uuid,text,uuid,text,text,integer),public.club_content_report(uuid,text,uuid,text,text),
 public.club_content_reports_page(uuid,boolean,timestamptz,uuid,integer),public.club_content_resolve(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
