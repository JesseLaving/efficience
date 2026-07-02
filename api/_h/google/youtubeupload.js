/* YouTube Data API v3 — step 1 of a resumable video upload: initiate the
   session (small JSON body, fits comfortably in a serverless function) and
   hand back the per-session upload URL. The actual video bytes are PUT
   directly from the browser to that URL (see src/lib/google.ts) — never
   through this function, since Vercel's request body limit (a few MB) can't
   hold a video file and the execution timeout can't hold a slow upload. */
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
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, title, description, privacyStatus, fileSize, fileType } = body || {};
  if (!token || !title || !fileSize || !fileType) return json(res, 400, { ok: false, reason: 'token, title, fileSize et fileType requis.' });

  try {
    const r = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(fileSize),
        'X-Upload-Content-Type': fileType,
      },
      body: JSON.stringify({
        snippet: { title: String(title).slice(0, 100), description: (description || '').slice(0, 5000) },
        status: { privacyStatus: ['public', 'unlisted', 'private'].includes(privacyStatus) ? privacyStatus : 'unlisted' },
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return json(res, 200, { ok: false, reason: (d.error && d.error.message) || `HTTP ${r.status}`, authError: r.status === 401 });
    }
    const uploadUrl = r.headers.get('location');
    if (!uploadUrl) return json(res, 200, { ok: false, reason: 'Session d’upload non renvoyée par YouTube.' });
    return json(res, 200, { ok: true, uploadUrl });
  } catch (e) {
    return json(res, 500, { ok: false, reason: String(e && e.message || e) });
  }
}
