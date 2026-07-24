CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  task_title    TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  r2_key        TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  uploaded_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_project_city ON photos(project_id, city_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_photos_team ON photos(project_id, city_id, team_name);
