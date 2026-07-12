CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE core.attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('objective','subjective')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  subject_user_id uuid NOT NULL,
  author_user_id uuid,
  attribute_id uuid NOT NULL REFERENCES core.attributes(id),
  kind text NOT NULL CHECK (kind IN ('objective','subjective')),
  value_numeric double precision,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_subject_org_idx ON core.evidence(subject_user_id, org_id);

CREATE TABLE core.validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES core.evidence(id) ON DELETE CASCADE,
  validator_user_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('yes','no','no_signal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_id, validator_user_id)
);
