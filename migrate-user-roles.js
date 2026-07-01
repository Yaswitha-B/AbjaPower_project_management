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

    // Our own access allowlist, separate from Neon Auth's own user table (neon_auth.user).
    // Neon verifies an email is real; this table says whether that email is allowed in
    // and with what role. project_ids: [] means "all projects" (admin/curator default).
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        email        TEXT PRIMARY KEY,
        name         TEXT,
        role         TEXT NOT NULL DEFAULT 'reporter' CHECK (role IN ('admin','curator','reporter')),
        project_ids  JSONB NOT NULL DEFAULT '[]',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await client.query('COMMIT');

    const check = await client.query(`SELECT to_regclass('user_roles') AS table_exists`);
    console.log('Migration complete.');
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
