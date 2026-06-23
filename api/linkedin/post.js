/* LinkedIn — publish a text post on the connected member's profile.
   Uses the UGC Posts API (works with w_member_social, no version header).
   POST body: { token, text }. */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, status, data) {
  cors(res); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = status; res.end(JSON.stringify(data));
}
async function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'POST') return json(res, 405, { error: 'POST requis' });
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, text } = body || {};
  if (!token || !text || !text.trim()) return json(res, 400, { error: 'token et text requis.' });

  try {
    // 1) resolve the author URN
    const ui = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    const uj = await ui.json();
    if (!uj.sub) return json(res, 200, { ok: false, reason: uj.error_description || uj.message || 'Identité LinkedIn introuvable' });
    const author = `urn:li:person:${uj.sub}`;

    // 2) publish the UGC post
    const payload = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text.trim() },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    };
    const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
      body: JSON.stringify(payload),
    });
    if (r.status === 201 || r.ok) {
      const id = r.headers.get('x-restli-id') || (await r.json().catch(() => ({}))).id || null;
      return json(res, 200, { ok: true, id, url: id ? `https://www.linkedin.com/feed/update/${id}` : null });
    }
    const err = await r.json().catch(() => ({}));
    return json(res, 200, { ok: false, reason: err.message || `HTTP ${r.status}` });
  } catch (e) {
    return json(res, 500, { error: 'Échec publication LinkedIn', detail: String(e && e.message || e) });
  }
}
