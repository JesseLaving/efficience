/* Get/save space data (everything from localStorage). */
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

  const { spaceId } = req.query;

  if (!spaceId) {
    res.statusCode = 400;
    res.json({ error: 'Space ID required' });
    return;
  }

  try {
    // Verify user owns this space
    const { rows: spaceRows } = await sql`
      SELECT id FROM spaces WHERE id = ${spaceId} AND user_id = ${session.userId}
    `;

    if (!spaceRows.length) {
      res.statusCode = 403;
      res.json({ error: 'Space not found or not owned by user' });
      return;
    }

    if (req.method === 'GET') {
      // Get space data
      const { rows } = await sql`
        SELECT data FROM space_data WHERE space_id = ${spaceId}
      `;

      if (rows.length > 0) {
        res.json(JSON.parse(rows[0].data));
      } else {
        res.json({});
      }
    } else if (req.method === 'POST') {
      // Save space data
      const { data } = req.body;

      if (!data) {
        res.statusCode = 400;
        res.json({ error: 'Data required' });
        return;
      }

      // Upsert (update if exists, insert if not)
      await sql`
        INSERT INTO space_data (space_id, data)
        VALUES (${spaceId}, ${JSON.stringify(data)})
        ON CONFLICT (space_id) DO UPDATE SET data = ${JSON.stringify(data)}, updated_at = NOW()
      `;

      res.json({ ok: true });
    } else {
      res.statusCode = 405;
      res.json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('Space data error:', e);
    res.statusCode = 500;
    res.json({ error: 'Database error' });
  }
}
