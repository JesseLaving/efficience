/* GET /api/spaces/list — list the signed-in user's spaces. */
import { query } from '../db.js';
import { json, requireSession } from './_util.js';

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  try {
    const { rows } = await query(
      `SELECT id, name, created_at, updated_at FROM app_spaces WHERE user_id = $1 ORDER BY updated_at DESC`,
      [session.userId]
    );
    json(res, 200, { spaces: rows });
  } catch (e) {
    json(res, 500, { error: 'Erreur base de données', detail: String(e && e.message || e) });
  }
}
