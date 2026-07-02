/* YouTube Data API v3 — read the connected channel's public stats (name,
   thumbnail, subscriber/view/video counts). Read-only, no data invented:
   subscriberCount can be hidden by the channel owner (hiddenSubscriberCount). */
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
  if (!token) return json(res, 400, { error: 'Paramètre "token" requis.' });
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const d = await r.json();
    if (d.error) return json(res, 200, { available: false, reason: d.error.message, authError: r.status === 401, channel: null });
    const ch = (d.items || [])[0];
    if (!ch) return json(res, 200, { available: false, reason: 'Aucune chaîne YouTube associée à ce compte.', channel: null });
    const stats = ch.statistics || {};
    return json(res, 200, {
      available: true,
      channel: {
        id: ch.id,
        title: ch.snippet?.title || null,
        thumbnail: ch.snippet?.thumbnails?.default?.url || ch.snippet?.thumbnails?.medium?.url || null,
        subscribers: stats.hiddenSubscriberCount ? null : (stats.subscriberCount != null ? +stats.subscriberCount : null),
        views: stats.viewCount != null ? +stats.viewCount : null,
        videos: stats.videoCount != null ? +stats.videoCount : null,
      },
    });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture YouTube', detail: String(e && e.message || e) });
  }
}
