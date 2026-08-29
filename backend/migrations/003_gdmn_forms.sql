-- Migration 002: bộ 7 biểu GDMN, tách khỏi dữ liệu nhân khẩu.
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
