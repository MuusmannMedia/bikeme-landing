BEGIN;

DO $requirements$
BEGIN
  IF to_regprocedure('extensions.hmac(bytea,bytea,text)') IS NULL
    OR to_regclass('vault.decrypted_secrets') IS NULL
    OR NOT has_table_privilege(current_user,'vault.decrypted_secrets','SELECT')
    OR has_table_privilege('authenticated','vault.decrypted_secrets','SELECT')
    OR has_table_privilege('anon','vault.decrypted_secrets','SELECT') THEN
    RAISE EXCEPTION 'GALLERY_ATTESTATION_DEPENDENCIES';
  END IF;
END;
$requirements$;

-- Seats and cleanup belong to the active member. The caller cannot
-- supply another actor, and the existing quota and request ledger still apply.
CREATE FUNCTION public.club_gallery_upload_reserve(p_club uuid,p_request uuid,p_digest text,p_count integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT public.club_gallery_reserve(club_private.require_user(),p_club,p_request,p_digest,p_count);
$$;

CREATE FUNCTION public.club_gallery_upload_release(p_request uuid,p_attempt uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT public.club_gallery_release(club_private.require_user(),p_request,p_attempt);
$$;

-- This capability attests to one batch that passed the web server's Sharp
-- checks. It is neither a Supabase API key nor an alternate user session.
CREATE FUNCTION public.club_gallery_upload_commit(
  p_club uuid,p_request uuid,p_attempt uuid,p_payload text,p_mac text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.require_user();
  secret_hex text;
  signing_key bytea;
  expected bytea;
BEGIN
  IF p_club IS NULL OR p_request IS NULL OR p_attempt IS NULL OR p_payload IS NULL
    OR octet_length(p_payload)>4000000 OR p_mac IS NULL OR p_mac !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;

  -- Avoid a Vault lookup or hashing a large batch for callers without a
  -- current membership and their own reservation. The commit still locks
  -- and repeats these checks to handle revocation and concurrent changes.
  IF club_private.role_for(p_club,actor) IS NULL THEN
    RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM club_private.gallery_uploads
    WHERE actor_id=actor AND club_id=p_club AND request_id=p_request AND attempt=p_attempt
      AND (committed_at IS NOT NULL OR expires_at>clock_timestamp())) THEN
    RAISE EXCEPTION 'GALLERY_CONFLICT' USING ERRCODE='PT409';
  END IF;

  SELECT CASE WHEN count(*)=1 THEN max(decrypted_secret) END INTO secret_hex
  FROM vault.decrypted_secrets WHERE name='club_gallery_upload_commit_hmac';
  IF secret_hex IS NULL OR secret_hex !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'GALLERY_ATTESTATION_UNAVAILABLE' USING ERRCODE='PT503';
  END IF;
  signing_key := decode(secret_hex,'hex');
  expected := extensions.hmac(convert_to(concat_ws(chr(10),'bikeme:club-gallery:commit:v1',
    actor::text,p_club::text,p_request::text,p_attempt::text,p_payload),'UTF8'),signing_key,'sha256');

  -- Compare independently blinded MACs rather than their raw prefixes.
  IF extensions.hmac(expected,signing_key,'sha256') IS DISTINCT FROM
     extensions.hmac(decode(p_mac,'hex'),signing_key,'sha256') THEN
    RAISE EXCEPTION 'GALLERY_ATTESTATION_INVALID' USING ERRCODE='42501';
  END IF;

  -- The original commit atomically rechecks membership, the reservation
  -- owner, current attempt and expiry before storing either representation.
  PERFORM public.club_gallery_commit(actor,p_club,p_request,p_attempt,p_payload::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.club_gallery_upload_reserve(uuid,uuid,text,integer),
  public.club_gallery_upload_release(uuid,uuid),public.club_gallery_upload_commit(uuid,uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_gallery_upload_reserve(uuid,uuid,text,integer),
  public.club_gallery_upload_release(uuid,uuid),public.club_gallery_upload_commit(uuid,uuid,uuid,text,text)
  TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
