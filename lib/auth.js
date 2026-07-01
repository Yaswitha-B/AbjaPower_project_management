import * as jose from 'jose';
import { getUserRole } from './db.js';

const AUTH_URL = process.env.VITE_NEON_AUTH_URL;
// Built lazily, not at module scope — a missing/malformed AUTH_URL must not
// throw at import time, which would crash every function that imports this
// module (read.js, write.js, auth.js) on cold start, not just auth requests.
let JWKS = null;
try {
  if (AUTH_URL) JWKS = jose.createRemoteJWKSet(new URL(`${AUTH_URL}/.well-known/jwks.json`));
} catch {
  JWKS = null;
}

// Verifies the Neon Auth bearer token on a request, then checks our own
// user_roles allowlist. Returns the caller's role record, or null if either
// the token or the allowlist check fails — callers treat both cases the same.
export async function verifySession(req) {
  if (!JWKS) return null;
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  let payload;
  try {
    ({ payload } = await jose.jwtVerify(token, JWKS, { issuer: new URL(AUTH_URL).origin }));
  } catch {
    return null;
  }

  if (!payload.email) return null;
  return getUserRole(payload.email);
}
