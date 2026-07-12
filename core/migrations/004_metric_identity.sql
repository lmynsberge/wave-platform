ALTER TABLE core.evidence ADD COLUMN source text, ADD COLUMN period text;
CREATE UNIQUE INDEX evidence_metric_key
  ON core.evidence(org_id, subject_user_id, attribute_id, source, period)
  WHERE source IS NOT NULL;
