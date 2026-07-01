import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Rename existing columns — metadata-only, preserves all historic rows exactly.
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mis_rows' AND column_name='manpower_total') THEN
          ALTER TABLE mis_rows RENAME COLUMN manpower_total TO hr_total;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mis_rows' AND column_name='manpower_detail') THEN
          ALTER TABLE mis_rows RENAME COLUMN manpower_detail TO hr_detail;
        END IF;
      END $$;
    `);

    // New per-project Human Resource role list. Existing projects get [] — by design,
    // per Yaswitha: don't block or backfill, curator adds roles as needed during review.
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS hr_roles JSONB NOT NULL DEFAULT '[]'`);

    // Views: read the renamed columns internally, keep output column names identical
    // (Overview.jsx / ProjectView.jsx consume total_man_days / avg_crew / man_days by these exact names).
    await client.query(`
      CREATE OR REPLACE VIEW project_summary AS
      SELECT
        p.id, p.name, p.discipline, p.lead, p.status, p.start_date, p.end_date,
        COUNT(DISTINCT m.date)                                     AS reported_days,
        COALESCE(SUM(m.hr_total), 0)                               AS total_man_days,
        COALESCE(ROUND(AVG(m.hr_total)::NUMERIC, 1), 0)            AS avg_crew,
        COALESCE(MAX(m.hr_total), 0)                               AS peak_crew,
        MAX(m.date)                                                AS last_report_date,
        COUNT(DISTINCT i.id)                                       AS distinct_blockers,
        COUNT(DISTINCT i.id) FILTER (WHERE i.stage != 'resolved')  AS open_blockers,
        COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'int')   AS blockers_internal,
        COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'ext')   AS blockers_external,
        COUNT(DISTINCT i.id) FILTER (WHERE i.owner_type = 'com')   AS blockers_compliance
      FROM projects p
      LEFT JOIN mis_rows m ON m.project_id = p.id
      LEFT JOIN issues  i ON i.project_id = p.id
      GROUP BY p.id, p.name, p.discipline, p.lead, p.status, p.start_date, p.end_date;
    `);

    await client.query(`
      CREATE OR REPLACE VIEW monthly_trend AS
      SELECT project_id, DATE_TRUNC('month', date) AS month, SUM(hr_total) AS man_days
      FROM mis_rows
      GROUP BY project_id, DATE_TRUNC('month', date)
      ORDER BY project_id, month;
    `);

    await client.query('COMMIT');

    const check = await client.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_name IN ('mis_rows','projects') AND column_name IN ('hr_total','hr_detail','hr_roles','manpower_total','manpower_detail')
      ORDER BY table_name, column_name
    `);
    console.log('Migration complete. Columns now:');
    console.table(check.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration FAILED — rolled back, no changes applied.');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
