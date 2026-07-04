/* TikTok Content Posting API — step 1 of a video upload: initialize the
   session (small JSON body, fits comfortably in a serverless function) and
   hand back the per-session upload URL. The actual video bytes are PUT
   directly from the browser to that URL (see src/lib/tiktok.ts) — never
   through this function, for the same reason as YouTube: Vercel's request
   body limit and execution timeout can't hold a video file/upload.

   Two modes:
   - mode 'direct' (video.publish scope): publishes immediately to the
     account's profile — needs post_info (title/privacy/interaction toggles).
   - mode 'inbox' (video.upload scope): sends the video to the account's
     TikTok inbox for the user to review and publish manually from the app
     — no post_info needed, fallback if Direct Post isn't approved yet. */
import { requireSession } from '../requireSession.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { ok: false, reason: 'POST requis' });
  if (!requireSession(req, res, (r, s, d) => json(r, s, { ok: false, reason: d.error }))) return;
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, title, privacyLevel, fileSize, disableComment, disableDuet, disableStitch, mode } = body || {};
  if (!token || !fileSize) return json(res, 400, { ok: false, reason: 'token et fileSize requis.' });

  const inbox = mode === 'inbox';
  const endpoint = inbox
    ? 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'
    : 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  const payload = {
    source_info: { source: 'FILE_UPLOAD', video_size: fileSize, chunk_size: fileSize, total_chunk_count: 1 },
  };
  if (!inbox) {
    payload.post_info = {
      title: (title || '').slice(0, 150),
      privacy_level: privacyLevel || 'SELF_ONLY',
      disable_comment: !!disableComment, disable_duet: !!disableDuet, disable_stitch: !!disableStitch,
    };
  }

  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (d.error && d.error.code !== 'ok') return json(res, 200, { ok: false, reason: d.error.message || d.error.code });
    const data = d.data || {};
    if (!data.upload_url) return json(res, 200, { ok: false, reason: 'Session d’upload non renvoyée par TikTok.' });
    return json(res, 200, { ok: true, uploadUrl: data.upload_url, publishId: data.publish_id || null });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}
