/* LinkedIn — publish a text post on the connected member's profile, or on a
   Company Page they administer.
   Uses the UGC Posts API (works with w_member_social, no version header).
   POST body: { token, text, photoUrl?, organizationId? }. If photoUrl is
   present, uploads the image and attaches it. organizationId (from
   /api/linkedin/organizations) posts as that Company Page instead of the
   member's own profile — requires w_organization_social on the token. */
import { requireSession } from '../requireSession.js';
import { originFrom } from '../origin.js';

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
  if (!requireSession(req, res, json)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : await readBody(req);
  const { token, text, photoUrl, organizationId } = body || {};
  if (!token || !text || !text.trim()) return json(res, 400, { error: 'token et text requis.' });

  try {
    // 1) resolve the author URN — a Company Page if one was picked, else the
    // member's own profile (the only option before Company Page support).
    let author;
    if (organizationId) {
      author = `urn:li:organization:${organizationId}`;
    } else {
      const ui = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
      const uj = await ui.json();
      if (!uj.sub) return json(res, 200, { ok: false, reason: uj.error_description || uj.message || 'Identité LinkedIn introuvable' });
      author = `urn:li:person:${uj.sub}`;
    }

    // 2) LinkedIn UGC Posts v2 doesn't support image attachments.
    // Workaround: use ARTICLE type with preview page that has og:image metadata.
    // LinkedIn will scrape the page and show the image as a rich preview.
    const shareContent = {
      shareCommentary: { text: text.trim() },
      shareMediaCategory: 'NONE',
    };

    if (photoUrl && photoUrl.trim()) {
      const previewUrl = `${originFrom(req)}/api/media/preview?` +
        'img=' + encodeURIComponent(photoUrl) +
        '&title=' + encodeURIComponent('Visuel Efficience');

      shareContent.shareMediaCategory = 'ARTICLE';
      shareContent.shareArticle = {
        source: previewUrl,
      };
    }

    const payload = {
      author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': shareContent,
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
    console.error('[LinkedIn UGC Post Error]', r.status, JSON.stringify(err));
    return json(res, 200, { ok: false, reason: err.message || err.detail?.['com.linkedin.common.error.ErrorInfo']?.[0]?.message || `HTTP ${r.status}` });
  } catch (e) {
    return json(res, 500, { error: 'Échec publication LinkedIn', detail: String(e && e.message || e) });
  }
}
