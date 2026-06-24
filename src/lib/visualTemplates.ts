import type { BrandKit } from './api';

export interface VisualTemplate { key: string; label: string; }
export const TEMPLATES: VisualTemplate[] = [
  { key: 'citation', label: 'Citation' },
  { key: 'annonce', label: 'Annonce' },
  { key: 'conseil', label: 'Conseil' },
  { key: 'question', label: 'Question' },
  { key: 'minimal', label: 'Minimal' },
];

/* ratio "w:h" → dimensions de rendu (px). */
export function dimsFor(ratio: string): { w: number; h: number } {
  const [rw, rh] = (ratio || '1:1').split(':').map(Number);
  if (!rw || !rh) return { w: 1080, h: 1080 };
  const W = 1080;
  return { w: W, h: Math.round((W * rh) / rw) };
}

const esc = (s: string) => (s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/* Luminance perçue → choix d'une couleur de texte lisible. */
function lum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0;
  const n = m[1];
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
const readable = (bg: string) => (lum(bg) > 0.6 ? '#0d1411' : '#ffffff');

/* Découpe un texte en lignes d'environ maxChars caractères (coupe aux espaces). */
function wrap(text: string, maxChars: number): string[] {
  const words = (text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

interface BuildOpts { template: string; brand: BrandKit; text: string; ratio: string; title?: string; logoData?: string | null; }

/* Construit le SVG d'un visuel de marque (couleurs/police/nom réels de la charte). */
export function buildVisual(opts: BuildOpts): string {
  const { template, brand, ratio } = opts;
  const { w, h } = dimsFor(ratio);
  const font = (brand.fonts && brand.fonts[0]) || 'Inter';
  const fam = `'${font}', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
  const accent = brand.accent || '#00d992';
  const dark = brand.dark || '#0a0f0d';
  const light = brand.light || '#f4fbf8';
  const name = (brand.name || 'Votre marque').toUpperCase();
  const text = (opts.text || '').trim();
  const pad = Math.round(w * 0.09);

  const wordmark = (x: number, y: number, color: string, anchor = 'start') => {
    const lg = opts.logoData
      ? `<image href="${opts.logoData}" x="${anchor === 'end' ? x - 64 : x}" y="${y - 34}" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>`
      : '';
    const tx = opts.logoData ? (anchor === 'end' ? x - 76 : x + 56) : x;
    return `${lg}<text x="${tx}" y="${y}" font-family="${fam}" font-size="26" font-weight="700" letter-spacing="2" fill="${color}" text-anchor="${anchor}">${esc(name)}</text>`;
  };

  // bloc de texte auto-dimensionné centré dans une zone
  const paragraph = (raw: string, x: number, top: number, boxW: number, boxH: number, color: string, opt: { max: number; min: number; weight: number; anchor?: string } ) => {
    const anchor = opt.anchor || 'start';
    let fs = opt.max;
    let lines: string[] = [];
    for (; fs >= opt.min; fs -= 4) {
      const maxChars = Math.max(8, Math.floor((boxW / (fs * 0.54))));
      lines = wrap(raw, maxChars);
      const lh = fs * 1.18;
      if (lines.length * lh <= boxH) break;
    }
    const lh = fs * 1.18;
    const totalH = lines.length * lh;
    let y = top + (boxH - totalH) / 2 + fs;
    const ax = anchor === 'middle' ? x + boxW / 2 : x;
    return lines.map((ln) => {
      const t = `<text x="${ax}" y="${y.toFixed(0)}" font-family="${fam}" font-size="${fs}" font-weight="${opt.weight}" fill="${color}" text-anchor="${anchor}">${esc(ln)}</text>`;
      y += lh;
      return t;
    }).join('');
  };

  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  const placeholder = !text ? `<text x="${w / 2}" y="${h / 2}" font-family="${fam}" font-size="34" fill="${accent}" text-anchor="middle" opacity="0.7">Votre texte apparaîtra ici…</text>` : '';

  if (template === 'question') {
    const txtCol = readable(accent);
    return `${open}
      <rect width="${w}" height="${h}" fill="${accent}"/>
      <text x="${pad}" y="${pad + 60}" font-family="${fam}" font-size="120" font-weight="800" fill="${txtCol}" opacity="0.25">?</text>
      ${text ? paragraph(text, pad, h * 0.22, w - 2 * pad, h * 0.5, txtCol, { max: 76, min: 34, weight: 800, anchor: 'start' }) : placeholder}
      ${wordmark(pad, h - pad, txtCol)}
    </svg>`;
  }

  if (template === 'minimal') {
    const txtCol = readable(light);
    return `${open}
      <rect width="${w}" height="${h}" fill="${light}"/>
      <rect x="${pad}" y="${pad}" width="46" height="6" rx="3" fill="${accent}"/>
      ${text ? paragraph(text, pad, h * 0.18, w - 2 * pad, h * 0.58, txtCol, { max: 66, min: 30, weight: 700 }) : placeholder}
      <line x1="${pad}" y1="${h - pad - 34}" x2="${w - pad}" y2="${h - pad - 34}" stroke="${txtCol}" stroke-opacity="0.12"/>
      ${wordmark(pad, h - pad, accent)}
    </svg>`;
  }

  if (template === 'annonce') {
    const txtCol = readable(dark);
    return `${open}
      <rect width="${w}" height="${h}" fill="${dark}"/>
      <rect x="0" y="0" width="${w}" height="14" fill="${accent}"/>
      <text x="${pad}" y="${pad + 54}" font-family="${fam}" font-size="26" font-weight="700" letter-spacing="3" fill="${accent}">${esc((opts.title || 'À LA UNE').toUpperCase())}</text>
      ${text ? paragraph(text, pad, h * 0.24, w - 2 * pad, h * 0.46, txtCol, { max: 70, min: 32, weight: 800 }) : placeholder}
      <rect x="${pad}" y="${h - pad - 60}" width="${w - 2 * pad}" height="2" fill="${accent}" opacity="0.4"/>
      ${wordmark(pad, h - pad, '#ffffff')}
    </svg>`;
  }

  if (template === 'conseil') {
    const txtCol = readable(light);
    return `${open}
      <rect width="${w}" height="${h}" fill="${light}"/>
      <rect x="0" y="0" width="16" height="${h}" fill="${accent}"/>
      <circle cx="${pad + 28}" cy="${pad + 40}" r="30" fill="${accent}"/>
      <text x="${pad + 28}" y="${pad + 52}" font-family="${fam}" font-size="34" font-weight="800" fill="${readable(accent)}" text-anchor="middle">!</text>
      <text x="${pad + 78}" y="${pad + 50}" font-family="${fam}" font-size="26" font-weight="700" letter-spacing="2" fill="${txtCol}" opacity="0.7">LE CONSEIL</text>
      ${text ? paragraph(text, pad, h * 0.26, w - 2 * pad, h * 0.46, txtCol, { max: 64, min: 30, weight: 700 }) : placeholder}
      ${wordmark(pad, h - pad, accent)}
    </svg>`;
  }

  // citation (défaut)
  const txtCol = readable(dark);
  return `${open}
    <rect width="${w}" height="${h}" fill="${dark}"/>
    <text x="${pad}" y="${pad + 110}" font-family="Georgia, 'Times New Roman', serif" font-size="180" fill="${accent}" opacity="0.85">“</text>
    ${text ? paragraph(text, pad, h * 0.26, w - 2 * pad, h * 0.46, txtCol, { max: 72, min: 32, weight: 700 }) : placeholder}
    <rect x="${pad}" y="${h - pad - 58}" width="60" height="5" rx="2" fill="${accent}"/>
    ${wordmark(pad, h - pad, '#ffffff')}
  </svg>`;
}
