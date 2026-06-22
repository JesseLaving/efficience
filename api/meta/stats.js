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

  try {
    const pagesRes = await g('me/accounts', 'name,access_token,fan_count,followers_count,instagram_business_account');
    if (pagesRes.error) return json(res, 400, { error: pagesRes.error.message });
    const accounts = [];

    for (const p of (pagesRes.data || [])) {
      const ptoken = p.access_token || token;

      // ---- Facebook page recent posts ----
      const fbPosts = [];
      const fp = await g(`${p.id}/posts`, 'message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)', ptoken, '&limit=12');
      if (!fp.error) {
        for (const post of (fp.data || [])) {
          fbPosts.push({
            id: post.id, network: 'facebook', type: 'post',
            caption: post.message || '', date: post.created_time || null, permalink: post.permalink_url || null,
            image: post.full_picture || null,
            likes: post.likes && post.likes.summary ? post.likes.summary.total_count : null,
            comments: post.comments && post.comments.summary ? post.comments.summary.total_count : null,
            shares: post.shares ? post.shares.count : 0,
          });
        }
      }
      accounts.push(buildAccount('facebook', p.name, p.followers_count != null ? p.followers_count : p.fan_count, fbPosts));

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
        accounts.push(buildAccount('instagram', (ig && (ig.name || ig.username)) || null, ig && ig.followers_count, igPosts, ig && ig.media_count));
      }
    }
    return json(res, 200, { accounts });
  } catch (e) {
    return json(res, 500, { error: 'Échec lecture des statistiques', detail: String(e && e.message || e) });
  }
}

function buildAccount(network, name, followers, posts, mediaCount) {
  const n = posts.length;
  const likes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const comments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const shares = posts.reduce((s, p) => s + (p.shares || 0), 0);
  const engRate = followers && n ? +(((likes + comments) / n / followers) * 100).toFixed(2) : null;
  return {
    network, name: name || null, followers: followers != null ? followers : null,
    mediaCount: mediaCount != null ? mediaCount : null,
    summary: { posts: n, likes, comments, shares, avgEngagement: n ? Math.round((likes + comments) / n) : 0, engagementRate: engRate },
    posts,
  };
}
