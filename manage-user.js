import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const [, , email, name, role] = process.argv;

if (!email || !role || !['admin', 'curator', 'reporter'].includes(role)) {
  console.error('Usage: node --env-file=.env manage-user.js <email> <name> <admin|curator|reporter>');
  process.exit(1);
}

async function run() {
  const { rows } = await pool.query(`
    INSERT INTO user_roles (email, name, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
    RETURNING *
  `, [email.toLowerCase(), name || null, role]);
  console.log('User upserted:');
  console.table(rows);
  await pool.end();
}

run();
