import pg from 'pg';
const { Pool } = pg;

console.log(process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function q(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function getProjects() {
  return q('SELECT * FROM project_summary ORDER BY status, name');
}

export async function getProject(id) {
  const rows = await q('SELECT * FROM project_summary WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getProjectConfig(id) {
  const rows = await q('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function getMisRows(projectId, { from, to } = {}) {
  if (from && to) {
    return q('SELECT * FROM mis_rows WHERE project_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date', [projectId, from, to]);
  }
  return q('SELECT * FROM mis_rows WHERE project_id = $1 ORDER BY date', [projectId]);
}

export async function getMonthlyTrend(projectId) {
  return q('SELECT month, man_days FROM monthly_trend WHERE project_id = $1', [projectId]);
}

export async function getActivityBreakdown(projectId) {
  return q(`
    SELECT act->>'activity' AS activity, SUM(m.manpower_total) AS man_days
    FROM mis_rows m, LATERAL jsonb_array_elements(m.activities) AS act
    WHERE m.project_id = $1
    GROUP BY act->>'activity'
    ORDER BY man_days DESC
  `, [projectId]);
}

export async function getTowerBreakdown(projectId) {
  return q(`
    SELECT act->>'tower' AS tower, SUM(m.manpower_total) AS man_days
    FROM mis_rows m, LATERAL jsonb_array_elements(m.activities) AS act
    WHERE m.project_id = $1
    GROUP BY act->>'tower'
    ORDER BY man_days DESC
  `, [projectId]);
}

export async function insertMisRow(data) {
  const { project_id, date, package: pkg, manpower_total, manpower_detail, activities, reported_by, source } = data;
  const rows = await q(`
    INSERT INTO mis_rows (project_id, date, package, manpower_total, manpower_detail, activities, reported_by, source)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
    ON CONFLICT (project_id, date, package) DO UPDATE
      SET manpower_total  = EXCLUDED.manpower_total,
          manpower_detail = EXCLUDED.manpower_detail,
          activities      = EXCLUDED.activities,
          reported_by     = EXCLUDED.reported_by
    RETURNING *
  `, [project_id, date, pkg, manpower_total,
      JSON.stringify(manpower_detail), JSON.stringify(activities),
      reported_by, source ?? 'form']);
  return rows[0];
}

export async function getIssues(projectId) {
  return q('SELECT * FROM issue_age WHERE project_id = $1 ORDER BY raised_date DESC', [projectId]);
}

export async function getOpenIssues(projectId) {
  return q(`
    SELECT ia.* FROM issue_age ia
    JOIN issues i ON i.id = ia.id
    WHERE ia.project_id = $1 AND i.stage != 'resolved'
    ORDER BY ia.raised_date
  `, [projectId]);
}

export async function insertIssue(data) {
  const { id, project_id, description, owner, owner_type, stage, waiting_on,
          needed_by, photo_in_group, raised_date, note, source, priority } = data;
  const rows = await q(`
    INSERT INTO issues (id, project_id, description, owner, owner_type, stage,
                        waiting_on, needed_by, photo_in_group, raised_date, note, source, priority)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [id, project_id, description, owner, owner_type ?? 'int', stage ?? 'raised',
      waiting_on ?? null, needed_by ?? null, photo_in_group ?? false,
      raised_date, note ?? null, source ?? 'form', priority ?? null]);
  return rows[0];
}

export async function updateIssue(id, patch) {
  const { stage, owner, waiting_on, note, resolved_date, recur } = patch;
  const rows = await q(`
    UPDATE issues SET
      stage         = COALESCE($1, stage),
      owner         = COALESCE($2, owner),
      waiting_on    = COALESCE($3, waiting_on),
      note          = COALESCE($4, note),
      resolved_date = COALESCE($5, resolved_date),
      recur         = COALESCE($6, recur),
      updated_at    = now()
    WHERE id = $7
    RETURNING *
  `, [stage ?? null, owner ?? null, waiting_on ?? null, note ?? null,
      resolved_date ?? null, recur ?? null, id]);
  return rows[0];
}

export async function getSightings(issueId) {
  return q('SELECT * FROM sightings WHERE issue_id = $1 ORDER BY date DESC', [issueId]);
}

export async function insertSighting(data) {
  const { issue_id, source, date, raw_text, implied_status, photo_in_group, reported_by } = data;
  const rows = await q(`
    INSERT INTO sightings (issue_id, source, date, raw_text, implied_status, photo_in_group, reported_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [issue_id, source ?? 'form', date, raw_text ?? null,
      implied_status ?? null, photo_in_group ?? false, reported_by ?? null]);
  return rows[0];
}

export async function getDependencies(issueId) {
  return q(`
    SELECT d.*, i.description AS to_description
    FROM issue_dependencies d
    LEFT JOIN issues i ON i.id = d.to_issue
    WHERE d.from_issue = $1
    ORDER BY d.dep_type, d.created_at
  `, [issueId]);
}

export async function insertDependency(data) {
  const { from_issue, to_issue, to_party, dep_type, note } = data;
  const rows = await q(`
    INSERT INTO issue_dependencies (from_issue, to_issue, to_party, dep_type, note)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [from_issue, to_issue ?? null, to_party ?? null, dep_type ?? 'sequential', note ?? null]);
  return rows[0];
}

export async function deleteDependency(id) {
  await q('DELETE FROM issue_dependencies WHERE id = $1', [id]);
}

export async function getCertEvents(projectId) {
  return q('SELECT * FROM cert_events WHERE project_id = $1 ORDER BY date', [projectId]);
}

export async function insertCertEvent(data) {
  const { project_id, date, event_text, is_qrm, source } = data;
  const rows = await q(`
    INSERT INTO cert_events (project_id, date, event_text, is_qrm, source)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [project_id, date, event_text, is_qrm ?? false, source ?? null]);
  return rows[0];
}

export async function getLatestSignals(projectId) {
  const rows = await q(`
    SELECT * FROM project_signals WHERE project_id = $1 ORDER BY period_end DESC LIMIT 1
  `, [projectId]);
  return rows[0] ?? null;
}

export async function upsertSignals(data) {
  const { project_id, period_start, period_end, resp_median_hours, resp_within_4h_pct,
          resp_nextday_pct, urgency_count, evidence_pct, league, league_note, caution_note } = data;
  const rows = await q(`
    INSERT INTO project_signals
      (project_id, period_start, period_end, resp_median_hours, resp_within_4h_pct,
       resp_nextday_pct, urgency_count, evidence_pct, league, league_note, caution_note)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
    RETURNING *
  `, [project_id, period_start, period_end, resp_median_hours, resp_within_4h_pct,
      resp_nextday_pct, urgency_count, evidence_pct, JSON.stringify(league),
      league_note ?? null, caution_note ?? null]);
  return rows[0];
}

export async function createProject(data) {
  const { id, name, discipline, id_prefix, towers, work_packages, activity_types,
          status, start_date, end_date } = data;
  const rows = await q(`
    INSERT INTO projects
      (id, name, discipline, id_prefix, towers, work_packages, activity_types,
       status, start_date, end_date)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10)
    RETURNING *
  `, [id, name, discipline, id_prefix,
      JSON.stringify(towers ?? []), JSON.stringify(work_packages ?? []), JSON.stringify(activity_types ?? []),
      status ?? 'active', start_date ?? null, end_date ?? null]);
  return rows[0];
}

export async function deleteProject(id) {
  // Must delete in FK dependency order — no CASCADE on most tables
  await q(`DELETE FROM sightings WHERE issue_id IN (SELECT id FROM issues WHERE project_id = $1)`, [id]);
  await q(`DELETE FROM issue_dependencies WHERE from_issue IN (SELECT id FROM issues WHERE project_id = $1) OR to_issue IN (SELECT id FROM issues WHERE project_id = $1)`, [id]);
  await q(`DELETE FROM issues          WHERE project_id = $1`, [id]);
  await q(`DELETE FROM mis_rows        WHERE project_id = $1`, [id]);
  await q(`DELETE FROM cert_events     WHERE project_id = $1`, [id]);
  await q(`DELETE FROM project_signals WHERE project_id = $1`, [id]);
  await q(`DELETE FROM projects        WHERE id = $1`, [id]);
}

export async function updateProject(id, data) {
  const { name, discipline, status, start_date, end_date, towers, work_packages, activity_types } = data;
  const rows = await q(`
    UPDATE projects SET
      name           = $1,
      discipline     = $2,
      status         = $3,
      start_date     = $4,
      end_date       = $5,
      towers         = $6::jsonb,
      work_packages  = $7::jsonb,
      activity_types = $8::jsonb
    WHERE id = $9
    RETURNING *
  `, [name, discipline, status, start_date ?? null, end_date ?? null,
      JSON.stringify(towers ?? []), JSON.stringify(work_packages ?? []), JSON.stringify(activity_types ?? []),
      id]);
  return rows[0] ?? null;
}

export async function addProjectActivity(projectId, activity) {
  const rows = await q(`
    UPDATE projects
    SET activity_types = activity_types || $1::jsonb
    WHERE id = $2
    RETURNING activity_types
  `, [JSON.stringify([activity]), projectId]);
  return rows[0] ?? null;
}

export async function addProjectZone(projectId, zone) {
  const rows = await q(`
    UPDATE projects
    SET towers = towers || $1::jsonb
    WHERE id = $2
    RETURNING towers
  `, [JSON.stringify([zone]), projectId]);
  return rows[0] ?? null;
}

export async function getAllMisRows() {
  return q(`
    SELECT m.*, p.name AS project_name
    FROM mis_rows m
    JOIN projects p ON p.id = m.project_id
    ORDER BY m.date DESC, m.project_id, m.package
  `);
}

export async function updateMisRow(id, data) {
  const { date, package: pkg, manpower_total, manpower_detail, activities, reported_by } = data;
  const rows = await q(`
    UPDATE mis_rows SET
      date            = COALESCE($1, date),
      package         = COALESCE($2, package),
      manpower_total  = COALESCE($3, manpower_total),
      manpower_detail = COALESCE($4::jsonb, manpower_detail),
      activities      = COALESCE($5::jsonb, activities),
      reported_by     = COALESCE($6, reported_by)
    WHERE id = $7
    RETURNING *
  `, [
    date ?? null, pkg ?? null, manpower_total ?? null,
    manpower_detail != null ? JSON.stringify(manpower_detail) : null,
    activities != null ? JSON.stringify(activities) : null,
    reported_by ?? null, id,
  ]);
  return rows[0] ?? null;
}

export async function getAllIssues() {
  return q(`
    SELECT ia.*, p.name AS project_name, i.verified_at, i.verified_by, i.priority
    FROM issue_age ia
    JOIN issues i ON i.id = ia.id
    JOIN projects p ON p.id = ia.project_id
    ORDER BY ia.raised_date DESC
  `);
}

export async function patchIssue(id, data) {
  const { description, owner, owner_type, stage, waiting_on, note, resolved_date, recur, raised_date, priority } = data;
  const rows = await q(`
    UPDATE issues SET
      description   = COALESCE($1, description),
      owner         = COALESCE($2, owner),
      owner_type    = COALESCE($3, owner_type),
      stage         = COALESCE($4, stage),
      waiting_on    = COALESCE($5, waiting_on),
      note          = COALESCE($6, note),
      resolved_date = COALESCE($7, resolved_date),
      recur         = COALESCE($8, recur),
      raised_date   = COALESCE($9, raised_date),
      priority      = $10,
      updated_at    = now()
    WHERE id = $11
    RETURNING *
  `, [
    description ?? null, owner ?? null, owner_type ?? null, stage ?? null,
    waiting_on ?? null, note ?? null, resolved_date ?? null,
    recur ?? null, raised_date ?? null, priority ?? null, id,
  ]);
  return rows[0] ?? null;
}

export async function getContacts(projectId) {
  return q('SELECT * FROM project_contacts WHERE project_id = $1 ORDER BY created_at', [projectId]);
}

export async function replaceContacts(projectId, contacts) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_contacts WHERE project_id = $1', [projectId]);
    const rows = [];
    for (const c of contacts ?? []) {
      const { rows: res } = await client.query(`
        INSERT INTO project_contacts (project_id, entity, contact_person, contact_number, email, category, party_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [projectId, c.entity, c.contact_person || null, c.contact_number || null,
          c.email || null, c.category || 'other', c.party_type || 'internal']);
      rows.push(res[0]);
    }
    await client.query('COMMIT');
    return rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUnverifiedMis(projectId) {
  if (projectId) {
    return q(`
      SELECT m.*, p.name AS project_name
      FROM mis_rows m JOIN projects p ON p.id = m.project_id
      WHERE m.project_id = $1 AND m.verified_at IS NULL
      ORDER BY m.date ASC
    `, [projectId]);
  }
  return q(`
    SELECT m.*, p.name AS project_name
    FROM mis_rows m JOIN projects p ON p.id = m.project_id
    WHERE m.verified_at IS NULL
    ORDER BY m.date ASC
  `);
}

export async function getUnverifiedIssues(projectId) {
  if (projectId) {
    return q(`
      SELECT ia.*, p.name AS project_name, i.verified_at, i.verified_by, i.verify_flag, i.priority
      FROM issue_age ia
      JOIN issues i ON i.id = ia.id
      JOIN projects p ON p.id = ia.project_id
      WHERE ia.project_id = $1 AND i.verified_at IS NULL
      ORDER BY ia.raised_date ASC
    `, [projectId]);
  }
  return q(`
    SELECT ia.*, p.name AS project_name, i.verified_at, i.verified_by, i.verify_flag, i.priority
    FROM issue_age ia
    JOIN issues i ON i.id = ia.id
    JOIN projects p ON p.id = ia.project_id
    WHERE i.verified_at IS NULL
    ORDER BY ia.raised_date ASC
  `);
}

export async function markMisVerified(id, verifiedBy, flag) {
  const rows = await q(`
    UPDATE mis_rows SET verified_at = now(), verified_by = $2, verify_flag = $3 WHERE id = $1 RETURNING *
  `, [id, verifiedBy ?? null, flag ?? null]);
  return rows[0] ?? null;
}

export async function markIssueVerified(id, verifiedBy, flag) {
  const rows = await q(`
    UPDATE issues SET verified_at = now(), verified_by = $2, verify_flag = $3, updated_at = now() WHERE id = $1 RETURNING *
  `, [id, verifiedBy ?? null, flag ?? null]);
  return rows[0] ?? null;
}

export async function markIssueUnverified(id) {
  const rows = await q(`
    UPDATE issues SET verified_at = NULL, verified_by = NULL, updated_at = now() WHERE id = $1 RETURNING *
  `, [id]);
  return rows[0] ?? null;
}

export async function markMisUnverified(id) {
  const rows = await q(`
    UPDATE mis_rows SET verified_at = NULL, verified_by = NULL WHERE id = $1 RETURNING *
  `, [id]);
  return rows[0] ?? null;
}


export async function nextIssueId(projectId) {
  const proj = await q('SELECT id_prefix FROM projects WHERE id = $1', [projectId]);
  if (!proj.length) throw new Error(`Unknown project: ${projectId}`);
  const cnt = await q('SELECT COUNT(*) AS count FROM issues WHERE project_id = $1', [projectId]);
  const seq = parseInt(cnt[0].count, 10) + 1;
  return `${proj[0].id_prefix}-${String(seq).padStart(2, '0')}`;
}
