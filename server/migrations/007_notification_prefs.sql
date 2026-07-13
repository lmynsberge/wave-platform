CREATE TABLE bridge_notification_prefs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opted_out boolean NOT NULL,
  PRIMARY KEY (user_id, org_id)
);
