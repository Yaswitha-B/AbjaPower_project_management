export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }
  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const expected = process.env.CURATOR_PASSWORD;
  if (!expected) {
    return Response.json({ error: 'Auth not configured' }, { status: 503 });
  }
  if (body.password === expected) {
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Wrong password' }, { status: 401 });
};

export const config = { path: '/api/auth' };
