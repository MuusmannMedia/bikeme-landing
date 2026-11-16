BEGIN;
-- Visitor clients address images by club/slot/revision. Storage paths contain
-- uploader identifiers and are neither necessary nor an authorization token.
CREATE OR REPLACE FUNCTION public.club_visit_profile(p_club uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles; f club_private.visit_flags;
BEGIN
 PERFORM club_private.visit_require('visits');
 IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;SELECT * INTO f FROM club_private.visit_flags WHERE singleton;
 RETURN jsonb_build_object('id',p_club,'name',v.name,'description',v.body,'revision',v.revision,'applications_open',v.applications_open AND f.applications,
 'has_cover',f.images AND v.cover_path IS NOT NULL,'has_logo',f.images AND v.logo_path IS NOT NULL,
 'cover_frame',CASE WHEN f.images AND v.cover_path IS NOT NULL THEN v.cover_frame-'source' END,
 'logo_frame',CASE WHEN f.images AND v.logo_path IS NOT NULL THEN v.logo_frame-'source' END);
END$$;
COMMIT;
