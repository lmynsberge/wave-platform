ALTER TABLE core.evidence
  ADD COLUMN state text NOT NULL DEFAULT 'active'
  CHECK (state IN ('active','pending_upward','dropped'));
CREATE INDEX evidence_state_idx ON core.evidence(org_id, state);
