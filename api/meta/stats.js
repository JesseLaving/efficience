/* Meta stats — real recent posts + engagement (likes/comments/shares) for each
   connected Facebook Page and linked Instagram account. Uses instagram_basic +
   pages_read_engagement (already granted). Account-level reach/impressions need
   instagram_manage_insights / read_insights (advanced) and are not fetched here. */
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
  const proof = (t) => (secret ? crypto.createHmac('sha256', secret).update(t).digest('hex') : '');
  const g = async (path, fields, tok, extra) => {
    const t = tok || token;
    const u = `https://graph.facebook.com/v21.0/${path}?access_token=${encodeURIComponent(t)}`
      + (secret ? `&appsecret_proof=${proof(t)}` : '')
      + (fields ? `&fields=${encodeURIComponent(fields)}` : '') + (extra || '');
    const r = await fetch(u);
    return r.json();
  };
  // Pull a metric value out of a Graph insights response (handles both
  // values[] and total_value shapes used across API versions).
  const metricVal = (data, name) => {
    const m = (data || []).find((x) => x.name === name);
    if (!m) return null;
    if (m.total_value && m.total_value.value != null) return m.total_value.value;
    const v = m.values;
    if (!v || !v.length) return null;
    // sum daily values for a period total, else take the single value
    if (v.length > 1) return v.reduce((s, x) => s + (typeof x.value === 'number' ? x.value : 0), 0);
    return v[0].value;
  };
  // Query each candidate metric individually so a deprecated/invalid name does
  // not fail the whole request. candidates: [{ key, metric, params }].
  const collectInsights = async (idPath, tok, candidates) => {
    const out = { available: false, reason: null };
    for (const c of candidates) {
      if (out[c.key] != null) continue;
      const r = await g(`${idPath}/insights`, null, tok, `&metric=${c.metric}${c.params || ''}`);
      if (r && r.data && r.data.length) { const val = metricVal(r.data, c.metric); if (val != null) { out[c.key] = val; out.available = true; } }
      else if (r && r.error && !out.reason) out.reason = r.error.message;
    }
    if (out.available) out.reason = null;
    return out;
  };
  const now = Math.floor(Date.now() / 1000), since28 = now - 28 * 86400;

  try {
    const pagesRes = await g('me/accounts', 'name,access_token,fan_count,followers_count,instagram_business_account');
    if (pagesRes.error) return json(res, 400, { error: pagesRes.error.message });
    const accounts = [];

    for (const p of (pagesRes.data || [])) {
      const ptoken = p.access_token || token;

      // ---- Facebook page recent posts ----
      // Try several edges/field-sets; record the reason if nothing comes back.
      const FULL = 'message,story,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)';
      const MIN = 'message,story,created_time,permalink_url,full_picture';
      const fbPosts = [];
      let fbReason = null;
      let fp = await g(`${p.id}/feed`, FULL, ptoken, '&limit=12');
      if (fp.error) { fbReason = fp.error.message; const a2 = await g(`${p.id}/feed`, MIN, ptoken, '&limit=12'); if (!a2.error) { fp = a2; fbReason = null; } }
      if (!fp.data || !fp.data.length) {
        const pub = await g(`${p.id}/published_posts`, MIN, ptoken, '&limit=12');
        if (pub.data && pub.data.length) { fp = pub; fbReason = null; }
        else if (pub.error) fbReason = fbReason || pub.error.message;
      }
      for (const post of (fp.data || [])) {
        fbPosts.push({
          id: post.id, network: 'facebook', type: 'post',
          caption: post.message || post.story || '', date: post.created_time || null, permalink: post.permalink_url || null,
          image: post.full_picture || null,
          likes: post.likes && post.likes.summary ? post.likes.summary.total_count : null,
          comments: post.comments && post.comments.summary ? post.comments.summary.total_count : null,
          shares: post.shares ? post.shares.count : 0,
        });
      }
      // Facebook Page insights (needs read_insights) — robust, metric-by-metric
      const fbIns = await collectInsights(p.id, ptoken, [
        { key: 'reach', metric: 'page_impressions_unique', params: '&period=days_28' },
        { key: 'reach', metric: 'page_impressions_unique', params: `&period=day&since=${since28}&until=${now}` },
        { key: 'engagement', metric: 'page_post_engagements', params: '&period=days_28' },
        { key: 'engagement', metric: 'page_post_engagements', params: `&period=day&since=${since28}&until=${now}` },
        { key: 'impressions', metric: 'page_impressions', params: '&period=days_28' },
        { key: 'impressions', metric: 'page_impressions', params: `&period=day&since=${since28}&until=${now}` },
      ]);
      accounts.push(buildAccount('facebook', p.name, p.followers_count != null ? p.followers_count : p.fan_count, fbPosts, null, fbIns, fbReason));

      // ---- Instagram recent media ----
      if (p.instagram_business_account && p.instagram_business_account.id) {
        const igId = p.instagram_business_account.id;
        const ig = await g(igId, 'username,name,followers_count,media_count', token);
        const media = await g(`${igId}/media`, 'caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', token, '&limit=12');
        const igPosts = [];
        if (!media.error) {
          for (const m of (media.data || [])) {
            igPosts.push({
              id: m.id, network: 'instagram', type: (m.media_type || 'IMAGE').toLowerCase(),
              caption: m.caption || '', date: m.timestamp || null, permalink: m.permalink || null,
              image: m.media_type === 'VIDEO' ? (m.thumbnail_url || null) : (m.media_url || null),
              likes: m.like_count != null ? m.like_count : null,
              comments: m.comments_count != null ? m.comments_count : null,
              shares: null,
            });
          }
        }
        // Instagram account insights (needs instagram_manage_insights) — robust
        const igIns = await collectInsights(igId, token, [
          { key: 'reach', metric: 'reach', params: `&period=day&since=${since28}&until=${now}` },
          { key: 'reach', metric: 'reach', params: '&period=day' },
          { key: 'profileViews', metric: 'profile_views', params: `&period=day&since=${since28}&until=${now}` },
        ]);
        accounts.push(buildAccount('instagram', (ig && (ig.name || ig.username)) || null, ig && ig.followers_count, igPosts, ig && ig.media_count, igIns));
      }
    }
    return json(res, 200, { accounts });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture des statistiques', detail: String(e && e.message || e) });
  }
}

function buildAccount(network, name, followers, posts, mediaCount, insights, postsReason) {
  const n = posts.length;
  const likes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const comments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const shares = posts.reduce((s, p) => s + (p.shares || 0), 0);
  const engRate = followers && n ? +(((likes + comments) / n / followers) * 100).toFixed(2) : null;
  return {
    network, name: name || null, followers: followers != null ? followers : null,
    mediaCount: mediaCount != null ? mediaCount : null,
    summary: { posts: n, likes, comments, shares, avgEngagement: n ? Math.round((likes + comments) / n) : 0, engagementRate: engRate },
    insights: insights || { available: false, reason: null },
    postsReason: postsReason || null,
    posts,
  };
}
