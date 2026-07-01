/* TikTok Content Posting API — query the creator's allowed privacy levels,
   duet/stitch/comment settings and max video duration. Must be called right
   before showing the publish form: TikTok requires it, and the options can
   vary per creator (age, country, account settings). */
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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const token = getParam(req, 'token');
  if (!token) return json(res, 400, { ok: false, reason: 'Paramètre "token" requis.' });
  try {
    const r = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    });
    const d = await r.json();
    if (d.error && d.error.code !== 'ok') return json(res, 200, { ok: false, reason: d.error.message || d.error.code });
    const c = d.data || {};
    return json(res, 200, {
      ok: true,
      creator: {
        nickname: c.creator_nickname || null, avatar: c.creator_avatar_url || null,
        privacyOptions: c.privacy_level_options || [],
        maxDurationSec: c.max_video_post_duration_sec || null,
        commentDisabled: !!c.comment_disabled, duetDisabled: !!c.duet_disabled, stitchDisabled: !!c.stitch_disabled,
      },
    });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}
