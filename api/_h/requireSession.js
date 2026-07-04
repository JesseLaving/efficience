/* Shared guard for the social-publish endpoints (meta/linkedin/google/tiktok
   post.js, tiktok/videoinit.js). Each of those already requires the target
   network's own access token, but that token alone doesn't prove the caller
   is a logged-in Efficience user — without this check, anyone who gets hold
   of a token (leak, replay, stolen from a browser) could call these routes
   directly, bypassing the app's login entirely. Returns the session on
   success, or writes a 401 JSON response and returns null. */
import { readSession } from './db.js';

export function requireSession(req, res, json) {
  const session = readSession(req.headers.cookie);
  if (!session || !session.userId) {
    json(res, 401, { error: 'Non authentifié' });
    return null;
  }
  return session;
}
