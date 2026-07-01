import { verifySession } from '../../lib/auth.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const user = await verifySession(req);
    if (!user) {
      return Response.json({ error: 'Not authorized' }, { status: 401 });
    }

    return Response.json({ ok: true, user });
  } catch (err) {
    console.error('auth error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
};

export const config = { path: '/api/auth' };
