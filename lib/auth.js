import * as jose from 'jose';
import { getUserRole } from './db.js';

const AUTH_URL = process.env.VITE_NEON_AUTH_URL;
const JWKS = jose.createRemoteJWKSet(new URL(`${AUTH_URL}/.well-known/jwks.json`));

// Verifies the Neon Auth bearer token on a request, then checks our own
// user_roles allowlist. Returns the caller's role record, or null if either
// the token or the allowlist check fails — callers treat both cases the same.
export async function verifySession(req) {
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
