-- Filter new text in posts, comments, shared chat, and private messages.
-- Report evidence and stored quote references are outside this filter.
BEGIN;

CREATE FUNCTION club_private.check_content_body() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  normalized text;
  token_boundary constant text := '[^[:alnum:]_À-ÖØ-öø-ÿĀ-ſ]';
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.body IS NOT DISTINCT FROM OLD.body THEN
    RETURN NULL;
  END IF;

  -- NFKC composes combining characters and folds compatibility forms such as
  -- fullwidth Latin letters. Keep Danish letters in the deterministic C locale.
  normalized := lower(translate(normalize(NEW.body, NFKC), 'ÆØÅ', 'æøå') COLLATE "C");
  normalized := translate(normalized, U&'\2018\2019\02BC', repeat(chr(39), 3));
  normalized := regexp_replace(normalized,
    U&'[\00AD\034F\061C\180E\200B-\200F\202A-\202E\2060-\206F\FE00-\FE0F\FEFF]', '', 'g');
  normalized := regexp_replace(normalized, U&'[\0085\2028\2029]', ' ', 'g');
  normalized := regexp_replace(normalized COLLATE "C", '[[:space:]]+', ' ', 'g');

  -- Each rule is literal and matches whole tokens. Spaces can be inserted
  -- between letters, while the spaces between words in threats remain required.
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'jeg dræber dig', 'jeg vil dræbe dig', 'jeg kommer og dræber dig',
      'jeg slår dig ihjel', 'jeg vil slå dig ihjel',
      'jeg skyder dig', 'jeg vil skyde dig',
      'jeg stikker dig ned', 'jeg vil stikke dig ned',
      'i will kill you', 'i''ll kill you', 'i am going to kill you', 'i''m going to kill you',
      'i will shoot you', 'i''ll shoot you', 'i am going to shoot you', 'i''m going to shoot you',
      'i will stab you', 'i''ll stab you', 'i will murder you', 'i''ll murder you',
      'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'jewboy', 'jewboys',
      'perker', 'perkere', 'perkersvin', 'negersvin', 'jødesvin', 'homosvin'
    ]) AS rules(phrase)
    WHERE normalized COLLATE "C" ~ (
      '(^|' || token_boundary || ')' ||
      regexp_replace(phrase, '([^ ])(?=[^ ])', '\1 *', 'g') ||
      '($|' || token_boundary || ')'
    )
  ) THEN
    -- Older clients treat 22023 as validation and let the user edit the draft.
    RAISE EXCEPTION 'BIKEME_CONTENT_REJECTED' USING ERRCODE = '22023';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION club_private.check_content_body() FROM PUBLIC, anon, authenticated, service_role;

-- Check only rows actually written. BEFORE INSERT would also reject a repeat
-- that the existing INSERT ... ON CONFLICT DO NOTHING treats as already saved.
-- An exception here aborts the write and any signals in the same transaction.
CREATE TRIGGER content_body_filter AFTER INSERT OR UPDATE OF body ON public.club_posts
  FOR EACH ROW WHEN (NEW.body <> '') EXECUTE FUNCTION club_private.check_content_body();
CREATE TRIGGER content_body_filter AFTER INSERT OR UPDATE OF body ON public.club_comments
  FOR EACH ROW WHEN (NEW.body <> '') EXECUTE FUNCTION club_private.check_content_body();
CREATE TRIGGER content_body_filter AFTER INSERT OR UPDATE OF body ON public.club_chat_messages
  FOR EACH ROW WHEN (NEW.body <> '') EXECUTE FUNCTION club_private.check_content_body();
CREATE TRIGGER content_body_filter AFTER INSERT OR UPDATE OF body ON dm_private.messages
  FOR EACH ROW WHEN (NEW.body <> '') EXECUTE FUNCTION club_private.check_content_body();

COMMIT;
