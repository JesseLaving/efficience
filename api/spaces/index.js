/* Manage user spaces (list, create, get, save). */
import { sql } from '@vercel/postgres';

function parseSession(cookie) {
  if (!cookie) return null;
  try {
    const sessionCookie = cookie.split(';').find(c => c.trim().startsWith('session='));
    if (!sessionCookie) return null;
    const token = sessionCookie.split('=')[1];
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const session = parseSession(req.headers.cookie);

  if (!session || !session.userId) {
    res.statusCode = 401;
    res.json({ error: 'Not authenticated' });
    return;
  }

  try {
    if (req.method === 'GET') {
      // List user's spaces
      const { rows } = await sql`
        SELECT id, name, created_at, updated_at FROM spaces
        WHERE user_id = ${session.userId}
        ORDER BY updated_at DESC
      `;
      res.json({ spaces: rows });
    } else if (req.method === 'POST') {
      // Create new space
      const { name } = req.body;
      if (!name) {
        res.statusCode = 400;
        res.json({ error: 'Space name required' });
        return;
      }

      const { rows } = await sql`
        INSERT INTO spaces (user_id, name)
        VALUES (${session.userId}, ${name})
        RETURNING id, name, created_at
      `;
      res.json(rows[0]);
    } else {
      res.statusCode = 405;
      res.json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('Spaces error:', e);
    res.statusCode = 500;
    res.json({ error: 'Database error' });
  }
}
