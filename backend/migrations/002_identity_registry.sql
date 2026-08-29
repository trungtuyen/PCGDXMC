-- Chỉ dùng identityHash ổn định, tốt nhất là HMAC/SHA-256 của mã định danh + secret phía server.
CREATE OR REPLACE FUNCTION enforce_person_identity_registry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE existing person_identity_registry%ROWTYPE;
BEGIN
  IF NEW.identity_hash IS NULL OR length(trim(NEW.identity_hash))=0 THEN
    NEW.identity_hash := NULLIF(trim(COALESCE(NEW.payload->>'identityHash','')),'');
  END IF;
  IF NEW.identity_hash IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO existing FROM person_identity_registry WHERE identity_hash=NEW.identity_hash FOR UPDATE;
  IF FOUND AND existing.person_id<>NEW.person_id THEN
    RAISE EXCEPTION 'duplicate_identity_hash' USING ERRCODE='23505';
  END IF;
  INSERT INTO person_identity_registry(identity_hash,person_id,province_key,commune_code,updated_at)
  VALUES(NEW.identity_hash,NEW.person_id,NEW.province_key,NEW.commune_code,now())
  ON CONFLICT(identity_hash) DO UPDATE SET province_key=EXCLUDED.province_key,commune_code=EXCLUDED.commune_code,updated_at=now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS persons_identity_registry_trg ON persons;
CREATE TRIGGER persons_identity_registry_trg BEFORE INSERT OR UPDATE OF identity_hash,payload,province_key,commune_code ON persons
FOR EACH ROW EXECUTE FUNCTION enforce_person_identity_registry();
