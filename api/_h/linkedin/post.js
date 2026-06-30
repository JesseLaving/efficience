/* LinkedIn — publish a text post on the connected member's profile.
   Uses the UGC Posts API (works with w_member_social, no version header).
   POST body: { token, text, photoUrl? }. If photoUrl is present, uploads the image and attaches it. */
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
  const { token, text, photoUrl } = body || {};
  if (!token || !text || !text.trim()) return json(res, 400, { error: 'token et text requis.' });

  try {
    // 1) resolve the author URN
    const ui = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    const uj = await ui.json();
    if (!uj.sub) return json(res, 200, { ok: false, reason: uj.error_description || uj.message || 'Identité LinkedIn introuvable' });
    const author = `urn:li:person:${uj.sub}`;

    // 2) if photoUrl is provided, upload the image
    let mediaElements = [];
    if (photoUrl && photoUrl.trim()) {
      try {
        // 2a) Register upload
        const regRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
          body: JSON.stringify({
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: author,
              serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
            },
          }),
        });
        const regData = await regRes.json().catch(() => ({}));
        console.error('[LinkedIn registerUpload]', regRes.status, JSON.stringify(regData).slice(0, 500));
        if (regData.value && regData.value.uploadMechanism && regData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']) {
          const uploadReq = regData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
          const assetUrn = regData.value.asset;
          console.error('[LinkedIn upload] uploadUrl:', uploadReq.uploadUrl, 'asset:', assetUrn);

          // 2b) Download image from photoUrl
          const imgRes = await fetch(photoUrl);
          if (!imgRes.ok) throw new Error(`Failed to fetch image: HTTP ${imgRes.status}`);
          const imgBuffer = await imgRes.arrayBuffer();

          // 2c) Upload to LinkedIn
          const uploadRes = await fetch(uploadReq.uploadUrl, {
            method: 'PUT',
            headers: uploadReq.headers || { 'Content-Type': 'image/jpeg' },
            body: imgBuffer,
          });
          if (!uploadRes.ok) throw new Error(`Image upload failed: HTTP ${uploadRes.status}`);

          // 2d) Finalize upload
          const finalRes = await fetch('https://api.linkedin.com/v2/assets?action=finalizeUpload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Restli-Protocol-Version': '2.0.0' },
            body: JSON.stringify({ finalizeUploadRequest: { upload: assetUrn } }),
          });
          if (finalRes.ok) {
            mediaElements = [{
              status: 'READY',
              media: assetUrn,
            }];
          }
        }
      } catch (imgErr) {
        // Silently skip image upload if it fails; post text-only instead
        console.error('Image upload failed:', imgErr);
      }
    }

    // 3) publish the UGC post
    const shareContent = {
      shareCommentary: { text: text.trim() },
      shareMediaCategory: mediaElements.length > 0 ? 'IMAGE' : 'NONE',
    };
    if (mediaElements.length > 0) {
      shareContent.shareMedia = mediaElements;
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
    return json(res, 200, { ok: false, reason: err.message || `HTTP ${r.status}` });
  } catch (e) {
    return json(res, 500, { error: 'Échec publication LinkedIn', detail: String(e && e.message || e) });
  }
}
