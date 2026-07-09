import { API_BASE } from './api';

export interface MetaAccount {
  network: 'instagram' | 'facebook';
  id: string;
  name: string | null;
  followers: number | null;
  handle?: string | null;
  mediaCount?: number | null;
  picture?: string | null;
  biography?: string | null;
  url?: string | null;
}
export interface MetaAccountsResponse { user: string | null; accounts: MetaAccount[]; }

const LS = 'eff_meta_token';
export const getStoredMetaToken = () => localStorage.getItem(LS);
export const setStoredMetaToken = (t: string) => localStorage.setItem(LS, t);
export const clearStoredMetaToken = () => localStorage.removeItem(LS);

/** Start the Meta OAuth flow (full-page redirect). Comes back to this exact
 *  app URL with the token (or error) in the URL hash. */
export function metaLogin(): void {
  const ret = location.origin + location.pathname;
  window.location.href = `${API_BASE}/meta/login?return=${encodeURIComponent(ret)}`;
}

/** Read meta_token / meta_error from the URL hash after the OAuth bounce,
 *  store the token, and clean the URL. Returns what it found. */
export function captureMetaHash(): { token?: string; error?: string } {
  if (!location.hash) return {};
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('meta_token') || undefined;
  const error = h.get('meta_error') || undefined;
  if (token || error) {
    if (token) setStoredMetaToken(token);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return { token, error };
}

export async function fetchMetaAccounts(token: string): Promise<MetaAccountsResponse> {
  const r = await fetch(`${API_BASE}/meta/accounts?token=${encodeURIComponent(token)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as MetaAccountsResponse;
}

export interface MetaPost {
  id: string; network: 'instagram' | 'facebook'; type: string;
  caption: string; date: string | null; permalink: string | null; image: string | null;
  likes: number | null; comments: number | null; shares: number | null;
}
export interface MetaInsights {
  available: boolean; reason?: string | null;
  reach?: number | null; impressions?: number | null; engagement?: number | null; profileViews?: number | null;
}
export interface MetaStatAccount {
  network: 'instagram' | 'facebook'; name: string | null; followers: number | null; mediaCount: number | null;
  summary: { posts: number; likes: number; comments: number; shares: number; avgEngagement: number; engagementRate: number | null };
  insights: MetaInsights;
  postsReason: string | null;
  posts: MetaPost[];
}
export interface MetaStatsResponse { accounts: MetaStatAccount[]; }

export async function fetchMetaStats(token: string): Promise<MetaStatsResponse> {
  const r = await fetch(`${API_BASE}/meta/stats?token=${encodeURIComponent(token)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && (data.error || data.detail)) || `HTTP ${r.status}`);
  return data as MetaStatsResponse;
}

export interface MetaPostResult { network: string; page?: string; ok: boolean; id?: string | null; reason?: string | null; }
export interface MetaPostResponse { ok: boolean; results?: MetaPostResult[]; reason?: string | null; }

export async function publishMetaPost(opts: { token: string; targets: string[]; message: string; photoUrl?: string }): Promise<MetaPostResponse> {
  const r = await fetch(`${API_BASE}/meta/post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
  return data as MetaPostResponse;
}

/* ---------- aggregates for the dashboard (all real, no invented figures) ---------- */
export interface MetaAggregates {
  followers: number;            // total abonnés across accounts
  engagementRate: number | null; // follower-weighted average rate (%), null if none
  totalEngagement: number;       // likes + comments + shares over analysed posts
  postsAnalyzed: number;         // count of posts the API returned
  postsMonth: number;            // posts published in the current calendar month
  reach: number | null;          // sum of insights reach where available
  impressions: number | null;    // sum of insights impressions where available
}

export function aggregateMeta(accounts: MetaStatAccount[] | null): MetaAggregates {
  const empty: MetaAggregates = { followers: 0, engagementRate: null, totalEngagement: 0, postsAnalyzed: 0, postsMonth: 0, reach: null, impressions: null };
  if (!accounts || !accounts.length) return empty;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let followers = 0, totalEngagement = 0, postsAnalyzed = 0, postsMonth = 0;
  let reach: number | null = null, impressions: number | null = null;
  let wRate = 0, wFollowers = 0; // for follower-weighted engagement rate
  for (const a of accounts) {
    followers += a.followers || 0;
    const s = a.summary;
    if (s) {
      totalEngagement += (s.likes || 0) + (s.comments || 0) + (s.shares || 0);
      postsAnalyzed += s.posts || 0;
      if (s.engagementRate != null && a.followers) { wRate += s.engagementRate * a.followers; wFollowers += a.followers; }
    }
    for (const p of (a.posts || [])) { if (p.date && p.date.slice(0, 7) === ym) postsMonth++; }
    if (a.insights) {
      if (a.insights.reach != null) reach = (reach || 0) + a.insights.reach;
      if (a.insights.impressions != null) impressions = (impressions || 0) + a.insights.impressions;
    }
  }
  return {
    followers, totalEngagement, postsAnalyzed, postsMonth, reach, impressions,
    engagementRate: wFollowers ? wRate / wFollowers : null,
  };
}

/** Collect real, dated posts as {t, v} points, v computed by `valueFn`.
 *  `sinceDays` (optional) keeps only posts from the last N days — this is what
 *  powers the dashboard period selector. Returns null when fewer than 2 dated
 *  points remain, so nothing is ever drawn from invented data. */
function postPoints(
  accounts: MetaStatAccount[] | null,
  valueFn: (p: MetaPost) => number,
  sinceDays?: number,
): { t: number; v: number }[] | null {
  if (!accounts) return null;
  const cutoff = sinceDays ? Date.now() - sinceDays * 86400000 : -Infinity;
  const pts: { t: number; v: number }[] = [];
  for (const a of accounts) {
    for (const p of (a.posts || [])) {
      if (!p.date) continue;
      const t = Date.parse(p.date);
      if (isNaN(t) || t < cutoff) continue;
      pts.push({ t, v: valueFn(p) });
    }
  }
  return pts.length < 2 ? null : pts.sort((x, y) => x.t - y.t);
}

function bucketize(pts: { t: number; v: number }[], buckets: number): number[] {
  const min = pts[0].t, max = pts[pts.length - 1].t, span = Math.max(1, max - min);
  const values = new Array(buckets).fill(0);
  for (const p of pts) values[Math.min(buckets - 1, Math.floor(((p.t - min) / span) * buckets))] += p.v;
  return values;
}

const postEngagement = (p: MetaPost) => (p.likes || 0) + (p.comments || 0) + (p.shares || 0);

/** Build an engagement-over-time series from recent posts (likes+comments+shares),
 *  bucketed into `buckets` slices across the real date span of the posts.
 *  `sinceDays` limits it to the last N days (period selector).
 *  Returns null when there isn't enough dated data to draw an honest line. */
export interface MetaSeries { values: number[]; labels: string[]; total: number; from: string; to: string; }
export function engagementSeries(accounts: MetaStatAccount[] | null, buckets = 12, sinceDays?: number): MetaSeries | null {
  const pts = postPoints(accounts, postEngagement, sinceDays);
  if (!pts) return null;
  const min = pts[0].t, max = pts[pts.length - 1].t, span = Math.max(1, max - min);
  const fmtD = (ms: number) => { const d = new Date(ms); return `${d.getDate()}/${d.getMonth() + 1}`; };
  return { values: bucketize(pts, buckets), labels: [fmtD(min), fmtD(min + span / 2), fmtD(max)], total: pts.reduce((s, p) => s + p.v, 0), from: fmtD(min), to: fmtD(max) };
}

/** Tiny real series for a KPI sparkline. Only post-derived metrics that actually
 *  have history return data; snapshot-only metrics (followers/reach) return null
 *  → no sparkline, never a fabricated trend. */
export function kpiSparkline(accounts: MetaStatAccount[] | null, metric?: string, buckets = 10): number[] | null {
  const valueFn = metric === 'postsMonth' ? () => 1
    : metric === 'totalEngagement' ? postEngagement
      : null;
  if (!valueFn) return null;
  const pts = postPoints(accounts, valueFn);
  return pts ? bucketize(pts, buckets) : null;
}
