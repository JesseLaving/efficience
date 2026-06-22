/* Meta data read — given the user's token (held in their browser), return the
   real Facebook Pages + linked Instagram Business accounts with follower counts
   and basic insights. App Secret is used server-side only, to sign requests
   (appsecret_proof). No data is invented. */
import crypto from 'node:crypto';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { error: 'Paramètre "token" requis.' });
  const secret = process.env.META_APP_SECRET || '';
  const proof = secret ? crypto.createHmac('sha256', secret).update(token).digest('hex') : '';
  const g = async (path, fields) => {
    const u = `https://graph.facebook.com/v21.0/${path}?access_token=${encodeURIComponent(token)}`
      + (proof ? `&appsecret_proof=${proof}` : '') + (fields ? `&fields=${encodeURIComponent(fields)}` : '');
    const r = await fetch(u);
    return r.json();
  };
  try {
    const me = await g('me', 'name');
    const pagesRes = await g('me/accounts', 'name,fan_count,followers_count,instagram_business_account,link');
    if (pagesRes.error) return json(res, 400, { error: pagesRes.error.message, user: me && me.name });
    const accounts = [];
    for (const p of (pagesRes.data || [])) {
      accounts.push({
        network: 'facebook', id: p.id, name: p.name || null,
        followers: (p.followers_count != null ? p.followers_count : (p.fan_count != null ? p.fan_count : null)),
        url: p.link || null,
      });
      if (p.instagram_business_account && p.instagram_business_account.id) {
        const ig = await g(p.instagram_business_account.id, 'username,name,followers_count,media_count,profile_picture_url,biography');
        if (!ig.error) {
          accounts.push({
            network: 'instagram', id: ig.id, name: ig.name || ig.username || null,
            handle: ig.username ? '@' + ig.username : null,
            followers: ig.followers_count != null ? ig.followers_count : null,
            mediaCount: ig.media_count != null ? ig.media_count : null,
            picture: ig.profile_picture_url || null,
            biography: ig.biography || null,
          });
        }
      }
    }
    return json(res, 200, { user: me && me.name, accounts });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture Meta', detail: String(e && e.message || e) });
  }
}
