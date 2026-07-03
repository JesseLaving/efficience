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

const absUrl = (src, base) => { try { return new URL(src, base).toString(); } catch { return null; } };

/* Extrait la charte graphique réelle depuis le HTML/CSS de la page :
   couleurs dominantes, logo, polices et nom. Aucune valeur inventée —
   ce qui n'est pas trouvé reste null / liste vide. */
function extractBrand(html, baseUrl, seo) {
  const scan = html.slice(0, 400000);
  const themeColor = attrContent(scan, 'theme-color');
  const siteName = attrContent(scan, 'og:site_name') || (seo && seo.ogTitle) || (seo && seo.title) || null;
  const name = siteName ? siteName.split(/[|\-–—·•:]/)[0].trim() : null;

  // --- logo ---
  let logo = null;
  const appleM = /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/i.exec(scan);
  const appleHref = appleM && /href=["']([^"']+)["']/i.exec(appleM[0]);
  const iconM = /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]*>/i.exec(scan);
  const iconHref = iconM && /href=["']([^"']+)["']/i.exec(iconM[0]);
  let imgLogo = null;
  const imgRe = /<img[^>]+>/gi; let im;
  while ((im = imgRe.exec(scan))) { if (/logo/i.test(im[0])) { const s = /src=["']([^"']+)["']/i.exec(im[0]); if (s) { imgLogo = s[1]; break; } } }
  const cand = imgLogo || (appleHref && appleHref[1]) || (seo && seo.ogImage) || (iconHref && iconHref[1]);
  if (cand) logo = absUrl(cand, baseUrl);

  // --- polices ---
  const fonts = [];
  const gfRe = /fonts\.googleapis\.com\/css2?\?([^"']+)/gi; let g;
  while ((g = gfRe.exec(scan))) {
    const famRe = /family=([^&"']+)/gi; let fm;
    while ((fm = famRe.exec(g[1]))) {
      const n = decodeURIComponent(fm[1]).split(':')[0].replace(/\+/g, ' ').trim();
      if (n && !fonts.includes(n)) fonts.push(n);
    }
  }
  const ffRe = /font-family\s*:\s*([^;}"']+)/gi; let f2;
  while ((f2 = ffRe.exec(scan)) && fonts.length < 5) {
    const first = f2[1].split(',')[0].replace(/["']/g, '').trim();
    if (first && !/^(inherit|initial|unset|sans-serif|serif|monospace|system-ui)$/i.test(first) && !/var\(/i.test(first) && !fonts.includes(first)) fonts.push(first);
  }

  // --- couleurs ---
  const counts = {};
  const add = (hex) => { counts[hex] = (counts[hex] || 0) + 1; };
  const hexRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi; let h;
  while ((h = hexRe.exec(scan))) { let hx = h[1].toLowerCase(); if (hx.length === 3) hx = hx.split('').map((c) => c + c).join(''); add(hx); }
  const rgbRe = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi; let rb;
  while ((rb = rgbRe.exec(scan))) { add([rb[1], rb[2], rb[3]].map((n) => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('')); }
  const props = (hex) => { const r = parseInt(hex.slice(0, 2), 16), gg = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16); const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); return { r, g: gg, b, sat: mx === 0 ? 0 : (mx - mn) / mx, light: (mx + mn) / 510 }; };
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map((e) => '#' + e[0]);
  const vivid = sorted.filter((c) => { const p = props(c.slice(1)); return p.sat > 0.22 && p.light > 0.12 && p.light < 0.9; });
  const palette = [];
  if (themeColor && /^#?[0-9a-fA-F]{3,6}$/.test(themeColor.trim())) { const t = themeColor.trim(); palette.push((t.startsWith('#') ? t : '#' + t).toLowerCase()); }
  for (const c of vivid) { if (!palette.includes(c) && palette.length < 5) palette.push(c); }
  const dark = sorted.find((c) => props(c.slice(1)).light < 0.22) || null;
  const light = sorted.find((c) => props(c.slice(1)).light > 0.92) || null;

  return {
    name, themeColor: themeColor || null, logo,
    fonts: fonts.slice(0, 4), palette,
    accent: palette[0] || null, dark, light,
    available: !!(palette.length || logo || fonts.length),
  };
}

// Mots vides français courants — filtrés pour ne garder que des mots-clés
// significatifs dans l'extraction de fréquence (jamais une liste inventée,
// seulement dérivée du texte réel de la page).
const STOPWORDS = new Set([
  'les', 'des', 'une', 'un', 'le', 'la', 'de', 'du', 'et', 'en', 'est', 'pour', 'sur', 'avec', 'dans', 'plus',
  'que', 'qui', 'vos', 'nos', 'nous', 'vous', 'ce', 'ces', 'son', 'sa', 'ses', 'aux', 'au', 'par', 'ou', 'à',
  'être', 'avoir', 'sont', 'ont', 'pas', 'tout', 'tous', 'toute', 'toutes', 'votre', 'notre', 'leur', 'leurs',
  'ne', 'se', 'il', 'elle', 'ils', 'elles', 'je', 'tu', 'on', 'mais', 'si', 'comme', 'sans', 'entre', 'sous',
  'the', 'and', 'for', 'you', 'your', 'with', 'from', 'this', 'that', 'are', 'our',
]);

/* Extrait les mots-clés dominants du texte RÉELLEMENT visible de la page
   (fréquence brute, mots vides filtrés) — jamais une liste inventée, un
   indicateur dérivé du contenu réel, comme la charte graphique. */
function extractKeywords(html, max = 10) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  const words = (text.toLowerCase().match(/[a-zàâäéèêëîïôöùûüçœæ]{4,}/g) || []);
  const counts = {};
  for (const w of words) { if (!STOPWORDS.has(w)) counts[w] = (counts[w] || 0) + 1; }
  return Object.entries(counts)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([word, count]) => ({ word, count }));
}

/* Détecte la présence de liens vers les pages légales obligatoires (mentions
   légales, CGV/CGU, politique de confidentialité, cookies) — simple
   présence/absence réelle constatée dans le HTML, pas une évaluation de
   conformité juridique complète. */
function detectLegalLinks(html) {
  // Capture le lien ENTIER (attributs + texte visible) — un lien peut être
  // reconnaissable par son href (« /confidentialite.html ») ou par son texte
  // (« Politique de confidentialité »), les deux doivent compter.
  const links = (html.match(/<a[^>]*>[\s\S]*?<\/a>/gi) || []).join(' ').toLowerCase();
  const has = (re) => re.test(links);
  return {
    mentionsLegales: has(/mentions[\s-]?l[ée]gales/),
    cgvCgu: has(/\bcgv\b|\bcgu\b|conditions[\s-]g[ée]n[ée]rales/),
    politiqueConfidentialite: has(/politique[\s-]de[\s-]confidentialit[ée]|privacy[\s-]policy/),
    cookies: has(/cookies?/),
  };
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
    const seo = {
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
      keywords: extractKeywords(body.slice(0, 400000)),
      legal: detectLegalLinks(body.slice(0, 400000)),
    };
    seo.brand = extractBrand(body, r.url, seo);
    return seo;
  }
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
/* Rejette les noms de fichiers de police « hashés » (Wix, CDN…) qui ne sont pas
   de vrais noms de famille : tokens trop longs, casse interne aléatoire,
   chiffres, ou sans voyelle. */
function isPlausibleFontName(name) {
  const toks = (name || '').split(/\s+/).filter(Boolean);
  if (!toks.length || toks.length > 4) return false;
  for (const t of toks) {
    if (t.length < 2 || t.length > 14) return false;
    if (!/^[A-Za-z]+$/.test(t)) return false;      // lettres uniquement
    if (/[A-Z]/.test(t.slice(1))) return false;    // pas de majuscule interne (camel/aléatoire)
    if (!/[aeiouy]/i.test(t)) return false;        // au moins une voyelle
  }
  return true;
}
function fontNameFromUrl(url) {
  try {
    const u = new URL(url);
    if (/fonts\.gstatic\.com$/i.test(u.hostname)) {
      const m = /\/s\/([^/]+)\//.exec(u.pathname);
      if (m) { const fam = titleCase(m[1].replace(/[-_]+/g, ' ').trim()); return isPlausibleFontName(fam) ? fam : null; }
    }
    let f = (u.pathname.split('/').pop() || '').replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '');
    f = f.replace(/[-_](regular|bold|semibold|demibold|medium|light|extralight|italic|oblique|thin|black|heavy|extrabold|book|roman|\d{2,3})/gi, '');
    f = f.replace(/[-_]+/g, ' ').trim();
    const fam = titleCase(f);
    return isPlausibleFontName(fam) ? fam : null;
  } catch { return null; }
}

/* Mine l'audit Lighthouse network-requests (page RENDUE en JS) pour récupérer
   les polices réellement chargées et un éventuel logo — ce que le HTML statique
   ne révèle pas sur un site rendu côté client. */
function extractBrandHints(audits) {
  const out = { fonts: [], logo: null };
  const nr = audits && audits['network-requests'];
  const items = (nr && nr.details && nr.details.items) || [];
  for (const it of items) {
    const url = it.url || '';
    const rt = it.resourceType || '';
    if (rt === 'Font' || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) {
      const fam = fontNameFromUrl(url);
      if (fam && !out.fonts.some((f) => f.toLowerCase() === fam.toLowerCase())) out.fonts.push(fam);
    } else if (!out.logo && (rt === 'Image') && /logo|brand[-_]?mark|wordmark/i.test(url)) {
      out.logo = url;
    }
  }
  out.fonts = out.fonts.slice(0, 4);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* L'audit Lighthouse (via PSI) échoue de façon transitoire assez souvent sur
   des sites réels (page lourde en JS, timeout interne au runner Google) —
   ce n'est pas propre à un site en particulier, un simple nouvel essai
   suffit la plupart du temps. Un seul essai supplémentaire, pas plus, pour
   rester dans le temps d'exécution de la fonction serverless. */
async function fetchPsi(url, key) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 55000);
  try {
    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}`
      + `&category=performance&category=seo&category=accessibility&category=best-practices&strategy=mobile`
      + (key ? `&key=${key}` : '');
    const r = await fetch(api, { signal: ctrl.signal });
    return await r.json();
  } finally { clearTimeout(t); }
}

async function pageSpeed(url, key) {
  try {
    let data = await fetchPsi(url, key);
    if (data.error && [500, 503].includes(data.error.code)) {
      await sleep(1200);
      data = await fetchPsi(url, key);
    }
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
      brandHints: extractBrandHints(a),
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
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const url = normalizeUrl(getParam(req, 'url'));
  if (!url) return json(res, 400, { error: 'Paramètre "url" requis (ex. efficiencemarketing.com).' });
  const withPsi = getParam(req, 'psi') !== '0';
  const key = process.env.GOOGLE_PSI_KEY || '';
  try {
    const basic = await basicFetch(url).catch((e) => ({ error: String(e && e.message || e) }));
    const brand = (basic && basic.brand) || null;
    if (basic && basic.brand) delete basic.brand;
    // Use the URL Lighthouse can actually load (after redirects / www fallback).
    const psiUrl = (basic && basic.finalUrl) || url;
    const psi = withPsi ? await pageSpeed(psiUrl, key) : { available: false, error: 'désactivé' };
    // Enrichit la charte (statique) avec ce que Lighthouse a vu sur la page rendue.
    const hints = psi && psi.brandHints;
    if (psi && psi.brandHints) delete psi.brandHints;
    if (brand && hints) {
      if ((!brand.fonts || !brand.fonts.length) && hints.fonts && hints.fonts.length) brand.fonts = hints.fonts;
      if (!brand.logo && hints.logo) brand.logo = absUrl(hints.logo, psiUrl) || hints.logo;
      brand.available = !!(brand.palette.length || brand.logo || brand.fonts.length);
    }
    return json(res, 200, { url, basic, brand, pagespeed: psi, psiKeyConfigured: !!key });
  } catch (e) {
    return json(res, 500, { error: 'Échec analyse du site', detail: String(e && e.message || e) });
  }
}
