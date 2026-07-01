import { verifySession } from '../../lib/auth.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await verifySession(req);
  if (!user) {
    return Response.json({ error: 'Not authorized' }, { status: 401 });
  }

  return Response.json({ ok: true, user });
};

export const config = { path: '/api/auth' };
