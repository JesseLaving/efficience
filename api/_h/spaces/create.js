/* POST /api/spaces/create { name } — create a new space for the signed-in user. */
import { query } from '../db.js';
import { json, readBody, requireSession } from './_util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  const session = requireSession(req, res);
  if (!session) return;
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const name = (body.name || '').trim();
  if (!name) return json(res, 400, { error: 'Nom de l\'espace requis' });
  try {
    const { rows } = await query(
      `INSERT INTO app_spaces (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at, updated_at`,
      [session.userId, name]
    );
    json(res, 200, rows[0]);
  } catch (e) {
    json(res, 500, { error: 'Erreur base de données', detail: String(e && e.message || e) });
  }
}
