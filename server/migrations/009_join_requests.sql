CREATE TABLE org_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES users(id)
);
CREATE UNIQUE INDEX org_join_requests_pending_uniq ON org_join_requests(org_id, user_id) WHERE status = 'pending';
