/* POST /api/spaces/logout — clear the session cookie. */
import { json } from './_util.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; Max-Age=0; SameSite=Lax');
  json(res, 200, { ok: true });
}
