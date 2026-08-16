/* Shared guard for the social-publish endpoints (meta/linkedin/google/tiktok
   post.js, tiktok/videoinit.js). Each of those already requires the target
   network's own access token, but that token alone doesn't prove the caller
   is a logged-in Efficience user — without this check, anyone who gets hold
   of a token (leak, replay, stolen from a browser) could call these routes
   directly, bypassing the app's login entirely. Returns the session on
   success, or writes a 401 JSON response and returns null. */
import { readSession } from './db.js';

/* Le cron de publication (api/cron/publish.js) appelle ces mêmes endpoints en
   self-fetch, sans navigateur donc sans cookie de session : il s'authentifie
   avec le même secret que sa propre route, passé en EN-TÊTE (jamais en URL,
   pour ne pas fuiter dans les logs d'accès). */
export function isCronRequest(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const provided = String(req.headers['x-cron-key'] || '').trim();
  return Boolean(secret) && provided === secret;
}

export function requireSession(req, res, json) {
  // userId 0 (falsy) : toute vérification de propriété en base échouera —
  // le cron n'a accès qu'aux routes de publication, pas aux données de compte.
  if (isCronRequest(req)) return { userId: 0, cron: true };
  const session = readSession(req.headers.cookie);
  if (!session || !session.userId) {
    json(res, 401, { error: 'Non authentifié' });
    return null;
  }
  return session;
}
