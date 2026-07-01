/* TikTok Display API — list the connected account's existing videos
   (thumbnail, view/like/comment/share counts). Read-only, one page (up to
   20 videos) — enough for a "vos vidéos" preview grid. */
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

const FIELDS = 'id,cover_image_url,share_url,video_description,duration,view_count,like_count,comment_count,share_count,create_time';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { ok: false, reason: 'Paramètre "token" requis.' });
  try {
    const r = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${FIELDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ max_count: 20 }),
    });
    const d = await r.json();
    if (d.error && d.error.code !== 'ok') return json(res, 200, { ok: false, reason: d.error.message || d.error.code, videos: [] });
    const videos = ((d.data && d.data.videos) || []).map((v) => ({
      id: v.id, cover: v.cover_image_url || null, url: v.share_url || null,
      description: v.video_description || null, durationSec: v.duration != null ? v.duration : null,
      views: v.view_count != null ? v.view_count : null, likes: v.like_count != null ? v.like_count : null,
      comments: v.comment_count != null ? v.comment_count : null, shares: v.share_count != null ? v.share_count : null,
      createdAt: v.create_time != null ? v.create_time * 1000 : null,
    }));
    return json(res, 200, { ok: true, videos });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}
