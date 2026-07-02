/* POST /api/spaces/rename { spaceId, name } — rename one of the signed-in
   user's own spaces. */
import { query } from '../db.js';
import { json, readBody, requireSession } from './_util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  const session = requireSession(req, res);
  if (!session) return;
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const spaceId = parseInt(body.spaceId, 10);
  const name = (body.name || '').trim();
  if (!spaceId) return json(res, 400, { error: 'spaceId requis' });
  if (!name) return json(res, 400, { error: 'Nom de l\'espace requis' });
  try {
    const { rows } = await query(
      `UPDATE app_spaces SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id, name, created_at, updated_at`,
      [name, spaceId, session.userId]
    );
    if (!rows.length) return json(res, 404, { error: 'Espace introuvable' });
    json(res, 200, rows[0]);
  } catch (e) {
    json(res, 500, { error: 'Erreur base de données', detail: String(e && e.message || e) });
  }
}
