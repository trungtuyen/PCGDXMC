-- PCGD-XMC nationwide schema (PostgreSQL 16+)
-- Tách dữ liệu chi tiết, tổng hợp và tài khoản để dashboard tỉnh/toàn quốc không quét bảng nhân khẩu.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pcgd_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province_key text NOT NULL,
  commune_code text NOT NULL,
  commune_name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'commune',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (province_key, commune_code)
);
CREATE INDEX IF NOT EXISTS pcgd_units_province_idx ON pcgd_units(province_key, active);

-- Tài khoản quản trị/nghiệp vụ. Không lưu mật khẩu rõ; password_hash dùng bcrypt.
CREATE TABLE IF NOT EXISTS app_users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE CHECK (username = lower(username)),
  password_hash text NOT NULL,
  display_name text,
  role text NOT NULL CHECK (role IN ('super_admin','national_admin','province_admin','commune_admin')),
  province_key text,
  commune_code text,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role IN ('super_admin','national_admin')) OR (role='province_admin' AND province_key IS NOT NULL) OR (role='commune_admin' AND province_key IS NOT NULL AND commune_code IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS app_users_scope_idx ON app_users(role, province_key, commune_code) WHERE active=true;

-- Bảng nhân khẩu chi tiết. Khóa chính bao gồm partition key để PostgreSQL cho phép partitioning.
CREATE TABLE IF NOT EXISTS persons (
  province_key text NOT NULL,
  person_id uuid NOT NULL DEFAULT gen_random_uuid(),
  commune_code text NOT NULL,
  school_id text,
  household_key text,
  identity_hash text,
  full_name text NOT NULL,
  birth_date date,
  sex smallint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (province_key, person_id)
) PARTITION BY HASH (province_key);

-- 16 partition khởi đầu; benchmark production quyết định tăng 32/64.
CREATE TABLE IF NOT EXISTS persons_p00 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 0);
CREATE TABLE IF NOT EXISTS persons_p01 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 1);
CREATE TABLE IF NOT EXISTS persons_p02 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 2);
CREATE TABLE IF NOT EXISTS persons_p03 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 3);
CREATE TABLE IF NOT EXISTS persons_p04 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 4);
CREATE TABLE IF NOT EXISTS persons_p05 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 5);
CREATE TABLE IF NOT EXISTS persons_p06 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 6);
CREATE TABLE IF NOT EXISTS persons_p07 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 7);
CREATE TABLE IF NOT EXISTS persons_p08 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 8);
CREATE TABLE IF NOT EXISTS persons_p09 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 9);
CREATE TABLE IF NOT EXISTS persons_p10 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 10);
CREATE TABLE IF NOT EXISTS persons_p11 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 11);
CREATE TABLE IF NOT EXISTS persons_p12 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 12);
CREATE TABLE IF NOT EXISTS persons_p13 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 13);
CREATE TABLE IF NOT EXISTS persons_p14 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 14);
CREATE TABLE IF NOT EXISTS persons_p15 PARTITION OF persons FOR VALUES WITH (MODULUS 16, REMAINDER 15);

CREATE INDEX IF NOT EXISTS persons_scope_birth_idx ON persons(province_key, commune_code, birth_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS persons_scope_school_idx ON persons(province_key, commune_code, school_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS persons_household_idx ON persons(province_key, commune_code, household_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS persons_updated_idx ON persons(province_key, commune_code, updated_at, person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS persons_identity_hash_idx ON persons(identity_hash) WHERE identity_hash IS NOT NULL AND deleted_at IS NULL;

-- Registry phát hiện một định danh đã xuất hiện ở địa bàn khác; chỉ lưu hash, không lưu số định danh rõ.
CREATE TABLE IF NOT EXISTS person_identity_registry (
  identity_hash text PRIMARY KEY,
  person_id uuid NOT NULL,
  province_key text NOT NULL,
  commune_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Gói tổng hợp cấp xã: vài nghìn bản ghi/năm thay vì hàng trăm triệu nhân khẩu.
CREATE TABLE IF NOT EXISTS commune_summaries (
  survey_year integer NOT NULL CHECK (survey_year BETWEEN 2000 AND 2100),
  province_key text NOT NULL,
  province_name text NOT NULL,
  commune_code text NOT NULL,
  commune_name text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  app_version text,
  metrics jsonb NOT NULL,
  checksum text,
  source_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_year, province_key, commune_code)
);
CREATE INDEX IF NOT EXISTS commune_summaries_year_province_idx ON commune_summaries(survey_year, province_key);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id text,
  actor_role text,
  province_key text,
  commune_code text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  request_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_log_scope_time_idx ON audit_log(province_key, commune_code, occurred_at DESC);

CREATE OR REPLACE VIEW province_summary AS
SELECT survey_year,province_key,max(province_name) AS province_name,count(*)::bigint AS communes,
  sum(COALESCE((metrics->>'total')::bigint,0)) AS total,
  sum(COALESCE((metrics->>'households')::bigint,0)) AS households,
  sum(COALESCE((metrics->>'aged1518')::bigint,0)) AS aged1518,
  sum(COALESCE((metrics->>'tn1518')::bigint,0)) AS tn1518,
  sum(COALESCE((metrics->>'age1560')::bigint,0)) AS age1560,
  sum(COALESCE((metrics->>'mc1560')::bigint,0)) AS mc1560,
  sum(COALESCE((metrics->>'disabilities')::bigint,0)) AS disabilities,
  sum(COALESCE((metrics->>'issues')::bigint,0)) AS issues
FROM commune_summaries GROUP BY survey_year,province_key;
