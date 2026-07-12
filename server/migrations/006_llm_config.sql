CREATE TABLE org_llm_config (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anthropic','openai_compatible')),
  base_url text,
  model text NOT NULL,
  api_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
