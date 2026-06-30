/* /api/spaces/data?spaceId=N
   GET  → return the space's stored data object.
   POST { data } → upsert the space's data. Both verify the space belongs to
   the signed-in user before touching it. */
import { query } from '../db.js';
import { json, readBody, getParam, requireSession } from './_util.js';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  const spaceId = parseInt(getParam(req, 'spaceId') || '', 10);
  if (!spaceId) return json(res, 400, { error: 'spaceId requis' });

  try {
    const owns = await query(`SELECT id FROM app_spaces WHERE id = $1 AND user_id = $2`, [spaceId, session.userId]);
    if (!owns.rows.length) return json(res, 403, { error: 'Espace introuvable' });

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
      const data = body.data;
      if (data == null || typeof data !== 'object') return json(res, 400, { error: 'data requis' });
      await query(
        `INSERT INTO app_space_data (space_id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (space_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [spaceId, JSON.stringify(data)]
      );
      await query(`UPDATE app_spaces SET updated_at = NOW() WHERE id = $1`, [spaceId]);
      return json(res, 200, { ok: true });
    }

    const { rows } = await query(`SELECT data FROM app_space_data WHERE space_id = $1`, [spaceId]);
    return json(res, 200, rows.length ? rows[0].data : {});
  } catch (e) {
    return json(res, 500, { error: 'Erreur base de données', detail: String(e && e.message || e) });
  }
}
