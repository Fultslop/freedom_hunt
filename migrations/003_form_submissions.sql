CREATE TABLE IF NOT EXISTS form_submissions (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  answers       TEXT NOT NULL,
  submitted_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_project_city
  ON form_submissions(project_id, city_id);
