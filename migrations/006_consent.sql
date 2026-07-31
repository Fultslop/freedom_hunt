CREATE TABLE IF NOT EXISTS consent_records (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  team_name         TEXT NOT NULL,
  contact           TEXT NOT NULL DEFAULT '',
  all_sixteen_plus  INTEGER NOT NULL,
  promo_consent     INTEGER NOT NULL,
  promo_approved    INTEGER NOT NULL DEFAULT 0,
  consent_version   INTEGER NOT NULL,
  acknowledged_at   INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (project_id, team_name, contact)
);
