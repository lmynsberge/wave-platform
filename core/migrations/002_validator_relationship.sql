ALTER TABLE core.validations
  ADD COLUMN validator_relationship text NOT NULL DEFAULT 'peer'
  CHECK (validator_relationship IN ('peer','manager_chain'));
