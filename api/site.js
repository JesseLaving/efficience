/* Serverless function — real website analysis.
   (1) Server-side fetch: status, redirects, HTTPS, server, size + any SEO tags
       present in the raw HTML (title, meta description, og, canonical, lang…).
   (2) Optional Google PageSpeed Insights (Lighthouse) when GOOGLE_PSI_KEY is set
       — render-aware perf/SEO/accessibility scores (handles JS-rendered sites).
   No invented values: missing data is reported as null. */

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
function normalizeUrl(u) {
  u = (u || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).toString(); } catch { return null; }
}
const pick = (re, html) => { const m = re.exec(html); return m && m[1] != null ? m[1].trim().replace(/\s+/g, ' ') : null; };
const attrContent = (html, key) => {
  const re = new RegExp('<meta[^>]+(?:name|property)=["\']' + key + '["\'][^>]*>', 'i');
  const m = re.exec(html);
  if (!m) return null;
  const c = /content=["\']([^"\']*)["\']/i.exec(m[0]);
  return c && c[1] != null ? c[1].trim() : null;
};

async function doFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    return await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EfficienceBot/1.0)' } });
  } finally { clearTimeout(t); }
}

async function basicFetch(url) {
  {
    let r;
    try { r = await doFetch(url); }
    catch (e) {
      // apex may not resolve — retry the www. variant once
      try { const u = new URL(url); if (!u.hostname.startsWith('www.')) { u.hostname = 'www.' + u.hostname; r = await doFetch(u.toString()); } else throw e; }
      catch { throw e; }
    }
    const body = await r.text();
    const head = body.slice(0, 200000);
    const count = (re) => (head.match(re) || []).length;
    return {
      status: r.status,
      finalUrl: r.url,
      https: r.url.startsWith('https://'),
      server: r.headers.get('server'),
      contentType: r.headers.get('content-type'),
      sizeKB: Math.round(body.length / 1024),
      lang: (/<html[^>]*\blang=["\']([^"\']+)["\']/i.exec(head) || [])[1] || null,
      title: pick(/<title[^>]*>([\s\S]*?)<\/title>/i, head),
      metaDescription: attrContent(head, 'description'),
      ogTitle: attrContent(head, 'og:title'),
      ogImage: attrContent(head, 'og:image'),
      canonical: (/(?:<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+))/i.exec(head) || [])[1] || null,
      viewport: attrContent(head, 'viewport') != null,
      h1Count: count(/<h1[\s>]/gi),
      imgCount: count(/<img[\s>]/gi),
      linkCount: count(/<a[\s>]/gi),
      jsRendered: !/<title[^>]*>[\s\S]*?<\/title>/i.test(head) && body.length > 50000,
    };
  }
}

async function pageSpeed(url, key) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}`
      + `&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile`
      + (key ? `&key=${key}` : '');
    const r = await fetch(api, { signal: ctrl.signal });
    const data = await r.json();
    if (data.error) return { available: false, error: `${data.error.code}: ${data.error.message}`.slice(0, 160) };
    const lr = data.lighthouseResult || {};
    const cat = lr.categories || {};
    const a = lr.audits || {};
    const score = (c) => (c && c.score != null ? Math.round(c.score * 100) : null);
    const dv = (id) => (a[id] && a[id].displayValue) || null;

    // Failed / imperfect audits per category → actionable "à corriger" lists.
    const failedFor = (catKey, max) => {
      const refs = (cat[catKey] && cat[catKey].auditRefs) || [];
      const out = [];
      for (const ref of refs) {
        const au = a[ref.id];
        if (!au || au.score == null) continue;
        if (au.scoreDisplayMode === 'notApplicable' || au.scoreDisplayMode === 'informative') continue;
        if (au.score < 0.9) out.push({ id: ref.id, title: au.title, score: au.score, displayValue: au.displayValue || null });
      }
      return out.sort((x, y) => x.score - y.score).slice(0, max || 8);
    };
    // Performance opportunities (estimated time savings).
    const opportunities = [];
    for (const id of Object.keys(a)) {
      const au = a[id];
      if (au && au.details && au.details.type === 'opportunity' && au.details.overallSavingsMs > 100) {
        opportunities.push({ id, title: au.title, savingsMs: Math.round(au.details.overallSavingsMs) });
      }
    }
    opportunities.sort((x, y) => y.savingsMs - x.savingsMs);

    return {
      available: true,
      strategy: 'mobile',
      scores: { performance: score(cat.performance), seo: score(cat.seo), accessibilite: score(cat.accessibility), bonnesPratiques: score(cat['best-practices']) },
      metrics: {
        fcp: dv('first-contentful-paint'), lcp: dv('largest-contentful-paint'),
        cls: dv('cumulative-layout-shift'), tbt: dv('total-blocking-time'),
        speedIndex: dv('speed-index'), tti: dv('interactive'), ttfb: dv('server-response-time'),
      },
      seoChecks: {
        title: a['document-title'] && a['document-title'].score === 1,
        metaDescription: a['meta-description'] && a['meta-description'].score === 1,
        httpStatus: a['http-status-code'] && a['http-status-code'].score === 1,
        crawlable: a['is-crawlable'] && a['is-crawlable'].score === 1,
        viewport: a.viewport && a.viewport.score === 1,
        hreflang: a.hreflang && a.hreflang.score === 1,
        structuredData: a['structured-data'] ? a['structured-data'].score === 1 : null,
      },
      issues: {
        seo: failedFor('seo', 8),
        accessibilite: failedFor('accessibility', 8),
        bonnesPratiques: failedFor('best-practices', 8),
      },
      opportunites: opportunities.slice(0, 6),
    };
  } catch (e) {
    return { available: false, error: String(e && e.message || e) };
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const url = normalizeUrl(getParam(req, 'url'));
  if (!url) return json(res, 400, { error: 'Paramètre "url" requis (ex. efficiencemarketing.com).' });
  const withPsi = getParam(req, 'psi') !== '0';
  const key = process.env.GOOGLE_PSI_KEY || '';
  try {
    const basic = await basicFetch(url).catch((e) => ({ error: String(e && e.message || e) }));
    // Use the URL Lighthouse can actually load (after redirects / www fallback).
    const psiUrl = (basic && basic.finalUrl) || url;
    const psi = withPsi ? await pageSpeed(psiUrl, key) : { available: false, error: 'désactivé' };
    return json(res, 200, { url, basic, pagespeed: psi, psiKeyConfigured: !!key });
  } catch (e) {
    return json(res, 500, { error: 'Échec analyse du site', detail: String(e && e.message || e) });
  }
}
