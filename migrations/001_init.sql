CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  hunt_mode    TEXT NOT NULL DEFAULT 'open',
  editor_mode  TEXT NOT NULL DEFAULT 'restricted',
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  email                   TEXT UNIQUE NOT NULL,
  username                TEXT UNIQUE NOT NULL,
  password_hash           TEXT NOT NULL,
  created_at              INTEGER NOT NULL,
  email_consent_results   INTEGER,
  email_consent_marketing INTEGER,
  email_consent_at        INTEGER
);

CREATE TABLE IF NOT EXISTS user_project_caps (
  user_id             TEXT NOT NULL REFERENCES users(id),
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  granted_at          INTEGER NOT NULL,
  granted_by_user_id  TEXT REFERENCES users(id),
  revoked_at          INTEGER,
  PRIMARY KEY (user_id, project_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_caps_user ON user_project_caps(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS invite_tokens (
  token               TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  used_at             INTEGER,
  revoked_at          INTEGER,
  invited_by_user_id  TEXT REFERENCES users(id)
);

-- Seed: DA abroad project
INSERT OR IGNORE INTO projects (id, hunt_mode, editor_mode, created_at)
VALUES ('democrats_abroad', 'limited', 'restricted', unixepoch());
