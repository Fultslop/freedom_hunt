CREATE TABLE IF NOT EXISTS participant_whitelist (
  email        TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  added_at     INTEGER NOT NULL,
  PRIMARY KEY (email, project_id)
);

CREATE TABLE IF NOT EXISTS participant_accounts (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  project_id     TEXT NOT NULL,
  team_name      TEXT NOT NULL,
  contact        TEXT,
  password_hash  TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE (email, project_id)
);
