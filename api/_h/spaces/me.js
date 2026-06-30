/* GET /api/spaces/me — return the signed-in user (or 401). Lets the client
   confirm auth without trusting the cookie payload itself. */
import { json, requireSession } from './_util.js';

export default function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;
  json(res, 200, { userId: session.userId, email: session.email, name: session.name });
}
