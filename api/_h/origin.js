/* Build the public origin (scheme://host) of the current request.
   Prefers the proxy-forwarded host so it resolves to whatever domain the
   user is actually visiting — behind Vercel's custom domains as well as the
   raw *.vercel.app URL — and falls back to the plain Host header.

   Use it anywhere an absolute URL must point back at the current domain
   (OAuth redirect URIs, link-preview URLs). Building these from the live
   request instead of a hardcoded domain means adding or switching a domain
   never requires a code change — and login/callback always agree on the
   exact same redirect_uri, which OAuth requires. */
export function originFrom(req) {
  const h = (req && req.headers) || {};
  const proto = String(h['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}
