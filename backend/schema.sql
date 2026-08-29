-- PCGD-XMC nationwide reference schema (PostgreSQL 16+)
-- Mục tiêu: tách dữ liệu chi tiết và dữ liệu tổng hợp để dashboard tỉnh/toàn quốc không quét bảng nhân khẩu.

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

CREATE TABLE IF NOT EXISTS persons (
  province_key text NOT NULL,
  person_id uuid NOT NULL DEFAULT gen_random_uuid(),
  commune_code text NOT NULL,
  school_id text,
  household_key text,
  full_name text NOT NULL,
  birth_date date,
  sex smallint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (province_key, person_id)
) PARTITION BY HASH (province_key);

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

-- 7 biểu GDMN tách khỏi dữ liệu nhân khẩu. Cấp xã ghi; tỉnh/toàn quốc chỉ đọc/tổng hợp.
-- payload.aggregate chỉ chứa số liệu có thể cộng gộp; payload.details chứa chi tiết trường/cơ sở (không chứa danh sách trẻ).
CREATE TABLE IF NOT EXISTS gdmn_forms (
  survey_year integer NOT NULL CHECK (survey_year BETWEEN 2000 AND 2100),
  province_key text NOT NULL,
  province_name text NOT NULL,
  commune_code text NOT NULL,
  commune_name text NOT NULL,
  form_code text NOT NULL CHECK (form_code IN ('MN-01-TE','MN-01-TCDK','MN-01-GV','MN-01-CSVC','MN-01-TC','MN-05-KT','MN-06-SO-PC')),
  schema_version integer NOT NULL DEFAULT 1,
  app_version text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_year, province_key, commune_code, form_code)
);
CREATE INDEX IF NOT EXISTS gdmn_forms_year_province_form_idx ON gdmn_forms(survey_year, province_key, form_code);
CREATE INDEX IF NOT EXISTS gdmn_forms_year_form_idx ON gdmn_forms(survey_year, form_code);

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
SELECT
  survey_year,
  province_key,
  max(province_name) AS province_name,
  count(*)::bigint AS communes,
  sum(COALESCE((metrics->>'total')::bigint,0)) AS total,
  sum(COALESCE((metrics->>'households')::bigint,0)) AS households,
  sum(COALESCE((metrics->>'aged1518')::bigint,0)) AS aged1518,
  sum(COALESCE((metrics->>'tn1518')::bigint,0)) AS tn1518,
  sum(COALESCE((metrics->>'age1560')::bigint,0)) AS age1560,
  sum(COALESCE((metrics->>'mc1560')::bigint,0)) AS mc1560,
  sum(COALESCE((metrics->>'disabilities')::bigint,0)) AS disabilities,
  sum(COALESCE((metrics->>'issues')::bigint,0)) AS issues
FROM commune_summaries
GROUP BY survey_year, province_key;
