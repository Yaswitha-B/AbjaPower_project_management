import { upsertUserRole } from './lib/db.js';
import { USER_ROLES } from './src/lib/constants.js';

const VALID_ROLES = USER_ROLES.map(r => r.value);
const [, , email, name, role] = process.argv;

if (!email || !role || !VALID_ROLES.includes(role)) {
  console.error(`Usage: node --env-file=.env manage-user.js <email> <name> <${VALID_ROLES.join('|')}>`);
  process.exit(1);
}

const result = await upsertUserRole({ email, name: name || null, role });
console.log('User upserted:');
console.table([result]);
process.exit(0);
