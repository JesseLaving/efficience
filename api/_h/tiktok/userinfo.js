/* TikTok Display API — read the connected account's public profile + stats.
   Read-only, no data invented: fields map 1:1 to what user.info.basic /
   user.info.stats actually grant. */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
function getParam(req, name) {
  if (req.query && req.query[name] != null) return req.query[name];
  try { return new URL(req.url, 'http://x').searchParams.get(name); } catch { return null; }
}

const FIELDS = 'open_id,display_name,avatar_url,username,bio_description,is_verified,follower_count,likes_count,video_count';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { error: 'Paramètre "token" requis.' });
  try {
    const r = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${FIELDS}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.error && d.error.code !== 'ok') return json(res, 200, { available: false, reason: d.error.message || d.error.code, profile: null });
    const u = d.data && d.data.user;
    if (!u) return json(res, 200, { available: false, reason: 'Profil TikTok introuvable.', profile: null });
    return json(res, 200, {
      available: true,
      profile: {
        openId: u.open_id, name: u.display_name || null, avatar: u.avatar_url || null,
        username: u.username ? '@' + u.username : null, bio: u.bio_description || null, verified: !!u.is_verified,
        followers: u.follower_count != null ? u.follower_count : null,
        likes: u.likes_count != null ? u.likes_count : null,
        videos: u.video_count != null ? u.video_count : null,
      },
    });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture TikTok', detail: String(e && e.message || e) });
  }
}
