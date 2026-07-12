CREATE TABLE bridge_link_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false
);

CREATE TABLE bridge_bindings (
  platform text NOT NULL,
  external_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, external_id)
);

CREATE TABLE bridge_ask_context (
  platform text NOT NULL,
  external_id text NOT NULL,
  ask_ids uuid[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (platform, external_id)
);
