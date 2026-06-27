CREATE TABLE IF NOT EXISTS projects (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  discipline     TEXT NOT NULL,
  lead           TEXT,
  id_prefix      TEXT NOT NULL,
  towers         JSONB NOT NULL DEFAULT '[]',
  work_packages  JSONB NOT NULL DEFAULT '[]',
  activity_types JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active',
  start_date     DATE,
  end_date       DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mis_rows (
  id               BIGSERIAL PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id),
  date             DATE NOT NULL,
  package          TEXT,
  manpower_total   INTEGER NOT NULL DEFAULT 0,
  manpower_detail  JSONB NOT NULL DEFAULT '{}',
  activities       JSONB NOT NULL DEFAULT '[]',
  reported_by      TEXT,
  source           TEXT NOT NULL DEFAULT 'form',
  verified_at      TIMESTAMPTZ,
  verified_by      TEXT,
  verify_flag      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (project_id, date, package)
);

CREATE INDEX IF NOT EXISTS mis_rows_project_date ON mis_rows (project_id, date);

CREATE TABLE IF NOT EXISTS issues (
  id             TEXT PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id),
  description    TEXT NOT NULL,
  owner          TEXT,
  owner_type     TEXT NOT NULL DEFAULT 'int',
  stage          TEXT NOT NULL DEFAULT 'raised',
  waiting_on     TEXT,
  needed_by      DATE,
  photo_in_group BOOLEAN NOT NULL DEFAULT false,
  recur          BOOLEAN NOT NULL DEFAULT false,
  note           TEXT,
  raised_date    DATE NOT NULL,
  resolved_date  DATE,
  source         TEXT NOT NULL DEFAULT 'steward',
  verified_at    TIMESTAMPTZ,
  verified_by    TEXT,
  verify_flag    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issues_project ON issues (project_id);
CREATE INDEX IF NOT EXISTS issues_stage   ON issues (stage);

CREATE TABLE IF NOT EXISTS sightings (
  id              BIGSERIAL PRIMARY KEY,
  issue_id        TEXT NOT NULL REFERENCES issues(id),
  source          TEXT NOT NULL DEFAULT 'form',
  date            DATE NOT NULL,
  raw_text        TEXT,
  implied_status  TEXT,
  photo_in_group  BOOLEAN NOT NULL DEFAULT false,
  reported_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sightings_issue ON sightings (issue_id);
CREATE INDEX IF NOT EXISTS sightings_date  ON sightings (date);

CREATE TABLE IF NOT EXISTS issue_dependencies (
  id           BIGSERIAL PRIMARY KEY,
  from_issue   TEXT NOT NULL REFERENCES issues(id),
  to_issue     TEXT REFERENCES issues(id),
  to_party     TEXT,
  dep_type     TEXT NOT NULL DEFAULT 'sequential',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (to_issue IS NOT NULL OR to_party IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS deps_from ON issue_dependencies (from_issue);
CREATE INDEX IF NOT EXISTS deps_to   ON issue_dependencies (to_issue);

CREATE TABLE IF NOT EXISTS cert_events (
  id           BIGSERIAL PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id),
  date         DATE NOT NULL,
  event_text   TEXT NOT NULL,
  is_qrm       BOOLEAN NOT NULL DEFAULT false,
  source       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cert_project ON cert_events (project_id, date);

CREATE TABLE IF NOT EXISTS project_signals (
  id                   BIGSERIAL PRIMARY KEY,
  project_id           TEXT NOT NULL REFERENCES projects(id),
  period_start         DATE NOT NULL,
  period_end           DATE NOT NULL,
  resp_median_hours    NUMERIC(6,2),
  resp_within_4h_pct   INTEGER,
  resp_nextday_pct     INTEGER,
  urgency_count        INTEGER,
  evidence_pct         INTEGER,
  league               JSONB,
  league_note          TEXT,
  caution_note         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signals_project ON project_signals (project_id, period_end DESC);

CREATE TABLE IF NOT EXISTS project_contacts (
  id             BIGSERIAL PRIMARY KEY,
  project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity         TEXT NOT NULL,
  contact_person TEXT,
  contact_number TEXT,
  email          TEXT,
  category       TEXT NOT NULL DEFAULT 'other'
                 CHECK (category IN ('design','management','customer','sub_contractor','other')),
  party_type     TEXT NOT NULL DEFAULT 'internal'
                 CHECK (party_type IN ('internal','customer','supplier_contractor')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_project ON project_contacts (project_id);

CREATE OR REPLACE VIEW project_summary AS
SELECT
  p.id,
  p.name,
  p.discipline,
  p.lead,
  p.status,
  p.start_date,
  p.end_date,
  COUNT(DISTINCT m.date)                                     AS reported_days,
  COALESCE(SUM(m.manpower_total), 0)                         AS total_man_days,
  COALESCE(ROUND(AVG(m.manpower_total)::NUMERIC, 1), 0)      AS avg_crew,
  COALESCE(MAX(m.manpower_total), 0)                         AS peak_crew,
  MAX(m.date)                                                AS last_report_date,

  COUNT(DISTINCT i.id)                                       AS distinct_blockers,
  COUNT(DISTINCT i.id) FILTER (WHERE i.stage != 'resolved')  AS open_blockers,
  COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'int')   AS blockers_internal,
  COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'ext')   AS blockers_external,
  COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'com')   AS blockers_compliance

FROM projects p
LEFT JOIN mis_rows m ON m.project_id = p.id
LEFT JOIN issues  i ON i.project_id = p.id
GROUP BY p.id, p.name, p.discipline, p.lead, p.status,
         p.start_date, p.end_date;

CREATE OR REPLACE VIEW monthly_trend AS
SELECT
  project_id,
  DATE_TRUNC('month', date) AS month,
  SUM(manpower_total)        AS man_days
FROM mis_rows
GROUP BY project_id, DATE_TRUNC('month', date)
ORDER BY project_id, month;

CREATE OR REPLACE VIEW issue_age AS
SELECT
  i.id,
  i.project_id,
  i.description,
  i.owner,
  i.owner_type,
  i.stage,
  i.recur,
  i.raised_date,
  i.resolved_date,
  i.waiting_on,
  i.note,
  CURRENT_DATE - i.raised_date                              AS age_days,
  MIN(s.date)                                               AS first_sighting,
  MAX(s.date)                                               AS last_sighting,
  COUNT(s.id)                                               AS sighting_count,
  CURRENT_DATE - MAX(s.date)                                AS quiet_days,
  MAX(s.date) - MIN(s.date)                                 AS days_open,
  COUNT(s.id) FILTER (WHERE s.photo_in_group = true)        AS sightings_with_photo
FROM issues i
LEFT JOIN sightings s ON s.issue_id = i.id
GROUP BY i.id, i.project_id, i.description, i.owner, i.owner_type,
         i.stage, i.recur, i.raised_date, i.resolved_date, i.waiting_on, i.note;
