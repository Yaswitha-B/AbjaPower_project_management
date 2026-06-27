const BASE = '/api';

async function request(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`);
  return res.json();
}

export const fetchPortfolio        = ()          => request('/read');
export const fetchProject          = (id)        => request(`/read?project=${id}`);
export const saveRecord            = (data)      => post('/write', data);
export const checkPassword         = (password)  => post('/auth', { password });
export const fetchAllMis           = ()          => request('/read?curator=mis');
export const fetchAllIssues        = ()          => request('/read?curator=issues');
export const fetchUnverifiedMis    = (projectId) => request(`/read?curator=mis_unverified${projectId ? `&project=${projectId}` : ''}`);
export const fetchUnverifiedIssues = (projectId) => request(`/read?curator=issues_unverified${projectId ? `&project=${projectId}` : ''}`);
