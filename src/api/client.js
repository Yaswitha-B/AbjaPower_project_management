import { authClient } from '../auth.js';

const BASE = '/api';

// One place that knows how to attach the current session — every call below
// goes through request()/post(), so nothing else has to think about auth.
async function authHeader() {
  const { data } = await authClient.getSession();
  const token = data?.session?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path) {
  const res = await fetch(BASE + path, { headers: await authHeader() });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`);
  return res.json();
}

export const fetchPortfolio        = ()          => request('/read');
export const fetchProject          = (id)        => request(`/read?project=${id}`);
export const saveRecord            = (data)      => post('/write', data);

// Verifies the current session against our own user_roles allowlist and
// returns the caller's role record. Throws if unauthorized.
export const checkSession          = ()          => post('/auth', {});

export const fetchAllMis           = ()          => request('/read?curator=mis');
export const fetchAllIssues        = ()          => request('/read?curator=issues');
export const fetchUnverifiedMis    = (projectId) => request(`/read?curator=mis_unverified${projectId ? `&project=${projectId}` : ''}`);
export const fetchUnverifiedIssues = (projectId) => request(`/read?curator=issues_unverified${projectId ? `&project=${projectId}` : ''}`);
export const fetchSightings        = (issueId)   => request(`/read?sightings=${issueId}`);

// Admin-only — server rejects this for non-admins regardless of who calls it.
export const fetchUsers            = ()          => request('/read?admin=users');
