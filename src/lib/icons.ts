/* ===== Efficience — icon set (ported from the design prototype) =====
   Brand glyphs (social platforms) + monochrome UI icons (stroke=currentColor).
   Each value is a raw SVG string, rendered through <Icon/> (dangerouslySetInnerHTML). */

const ui = (paths: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const UI = {
  grid: ui('<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/>'),
  menu: ui('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  link: ui('<path d="M9 15l6-6"/><path d="M11 6l1.5-1.5a4 4 0 0 1 5.7 5.7L16.5 12"/><path d="M13 18l-1.5 1.5a4 4 0 0 1-5.7-5.7L7.5 12"/>'),
  spark: ui('<path d="M12 3l1.6 4.8a3 3 0 0 0 1.9 1.9L20 11l-4.5 1.3a3 3 0 0 0-1.9 1.9L12 19l-1.6-4.8a3 3 0 0 0-1.9-1.9L4 11l4.5-1.3a3 3 0 0 0 1.9-1.9z"/><path d="M19 4v3M5 17v2"/>'),
  calendar: ui('<rect x="3.5" y="5" width="17" height="16" rx="2.4"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>'),
  chart: ui('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  inbox: ui('<path d="M3.5 13.5 6 6.5A2 2 0 0 1 7.9 5h8.2A2 2 0 0 1 18 6.5l2.5 7"/><path d="M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5h-5a3 3 0 0 1-6 0z"/>'),
  target: ui('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'),
  search: ui('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.6-3.6"/>'),
  bell: ui('<path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>'),
  plus: ui('<path d="M12 5v14M5 12h14"/>'),
  chevron: ui('<path d="M9 6l6 6-6 6"/>'),
  chevdown: ui('<path d="M6 9l6 6 6-6"/>'),
  check: ui('<path d="M5 12.5l4.5 4.5L19 7"/>'),
  refresh: ui('<path d="M20 11a8 8 0 1 0-.6 4"/><path d="M20 5v6h-6"/>'),
  more: ui('<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'),
  settings: ui('<circle cx="12" cy="12" r="3"/><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7.7 1.6 1.6 0 0 0-1.1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.2-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1A2 2 0 1 1 3.5 17l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4 8.6a1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 6.4 3.9l.1.1a1.6 1.6 0 0 0 1.8.3H8.4A1.6 1.6 0 0 0 9.4 2.9V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  help: ui('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"/><path d="M12 17h.01"/>'),
  unlink: ui('<path d="M9 15l6-6"/><path d="M11 6l1.5-1.5a4 4 0 0 1 5.7 5.7L16.5 12"/><path d="M13 18l-1.5 1.5a4 4 0 0 1-5.7-5.7L7.5 12"/><path d="M3 3l18 18"/>'),
  arrowup: ui('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowdown: ui('<path d="M12 5v14M18 13l-6 6-6-6"/>'),
  heart: ui('<path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 7a3.7 3.7 0 0 1 7 3.7C19 15.6 12 20 12 20z"/>'),
  eye: ui('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6"/>'),
  users: ui('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M21 20a6 6 0 0 0-4-5.7"/>'),
  clock: ui('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  image: ui('<rect x="3.5" y="4.5" width="17" height="15" rx="2.4"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17l4.5-4 3 2.5L16 11l4 4"/>'),
  send: ui('<path d="M21 4 3 11l6 2.5L12 20l3-7z"/><path d="M9 13.5 21 4"/>'),
  upload: ui('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 14v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  sheet: ui('<rect x="4" y="3" width="16" height="18" rx="2.2"/><path d="M4 9h16M4 15h16M10 3v18M16 3v18"/>'),
  filter: ui('<path d="M3 5h18l-7 8v5l-4 2v-7z"/>'),
  mail: ui('<rect x="3" y="5" width="18" height="14" rx="2.4"/><path d="M3.5 7l8.5 6 8.5-6"/>'),
  mailopen: ui('<path d="M3 9.5 12 3l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 9.5l9 6 9-6"/>'),
  euro: ui('<path d="M16.5 6.5A6 6 0 1 0 16.5 17M5.5 10.5h7M5.5 13.5h7"/>'),
  pin: ui('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'),
  tag: ui('<path d="M3 12.5V5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-6.5 6.5a2 2 0 0 1-2.8 0l-7-7A2 2 0 0 1 3 12.5z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>'),
  trash: ui('<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/>'),
  wand: ui('<path d="M5 19l9-9M14.5 5.5l1.2-1.2M19 10l1.5-.4M16 14l1.2 1.2M11 4.5l.5-1.5"/><path d="M13.5 8.5l2 2"/>'),
  download: ui('<path d="M12 4v11M8 11l4 4 4-4"/><path d="M4 19h16"/>'),
  edit: ui('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  close: ui('<path d="M6 6l12 12M18 6 6 18"/>'),
  play: ui('<path d="M7 5l12 7-12 7z"/>'),
  cursor: ui('<path d="M5 3l5 16 2.5-6.5L19 10z"/>'),
  sliders: ui('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
  rocket: ui('<path d="M5 15c-1 2-1 4-1 4s2 0 4-1M9.5 14.5l-3-3c2-6 6.5-8.5 11-8.5 0 4.5-2.5 9-8.5 11z"/><circle cx="14.5" cy="9.5" r="1.5"/>'),
  arrowright: ui('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  arrowleft: ui('<path d="M19 12H5M11 18l-6-6 6-6"/>'),
  clipboard: ui('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4M9 11h6M9 15h4"/>'),
  sparkles2: ui('<path d="M12 3l1.6 4.8a3 3 0 0 0 1.9 1.9L20 11l-4.5 1.3a3 3 0 0 0-1.9 1.9L12 19l-1.6-4.8a3 3 0 0 0-1.9-1.9L4 11l4.5-1.3a3 3 0 0 0 1.9-1.9z"/>'),
  dot: ui('<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'),
  shield: ui('<path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
} as const;

export type UIName = keyof typeof UI;

/* ---------- Brand glyphs (filled, brand-colored for dark UI) ---------- */
export const BRAND = {
  instagram: `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="ig-g" cx="30%" cy="107%" r="135%"><stop offset="0%" stop-color="#fed576"/><stop offset="26%" stop-color="#f47133"/><stop offset="61%" stop-color="#bc3081"/><stop offset="100%" stop-color="#4c63d2"/></radialGradient></defs><rect x="2.5" y="2.5" width="19" height="19" rx="5.4" fill="url(#ig-g)"/><rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3.4" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="17.5" cy="6.6" r="1.15" fill="#fff"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#1877F2"/><path d="M14.6 12.3h-1.9V20h-2.9v-7.7H8.3V9.7h1.5V8.2c0-2 1-3.2 3.3-3.2h1.7v2.5h-1.1c-.7 0-.9.4-.9 1v1.2h2.1z" fill="#fff"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="3.8" fill="#0A66C2"/><path d="M7.5 9.7H5.1V18h2.4zM6.3 5.5a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM18.9 18h-2.4v-4.3c0-1.1-.4-1.8-1.4-1.8-.7 0-1.2.5-1.4 1-.1.2-.1.5-.1.7V18H11s.03-7.4 0-8.3h2.4v1.2c.3-.5 1-1.3 2.5-1.3 1.8 0 3.1 1.2 3.1 3.7z" fill="#fff"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4.2c.3 1.9 1.4 3.4 3.3 3.7v2.5c-1.2 0-2.3-.4-3.3-1v5.2a4.9 4.9 0 1 1-4.9-4.9c.3 0 .5 0 .8.1v2.6a2.4 2.4 0 1 0 1.7 2.3V4.2z" fill="#25F4EE" transform="translate(-.9 .6)"/><path d="M14 4.2c.3 1.9 1.4 3.4 3.3 3.7v2.5c-1.2 0-2.3-.4-3.3-1v5.2a4.9 4.9 0 1 1-4.9-4.9c.3 0 .5 0 .8.1v2.6a2.4 2.4 0 1 0 1.7 2.3V4.2z" fill="#FE2C55" transform="translate(.8 -.2)"/><path d="M14 4.2c.3 1.9 1.4 3.4 3.3 3.7v2.5c-1.2 0-2.3-.4-3.3-1v5.2a4.9 4.9 0 1 1-4.9-4.9c.3 0 .5 0 .8.1v2.6a2.4 2.4 0 1 0 1.7 2.3V4.2z" fill="#f4f7f2"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3.5h2.9l-6.4 7.3 7.5 9.7h-5.9l-4.6-6-5.3 6H3.1l6.8-7.8L2.7 3.5h6l4.2 5.5zm-1 14.6h1.6L8.1 5.2H6.4z" fill="#f4f7f2"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5.5" width="20" height="13" rx="4" fill="#FF3B30"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff"/></svg>`,
  pinterest: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#E60023"/><path d="M12.3 6.4c-3 0-4.7 1.9-4.7 4 0 1 .4 2 1.3 2.4.1.1.2 0 .3-.2l.2-.7c0-.1 0-.2-.1-.3-.3-.4-.5-.9-.5-1.5 0-1.6 1.3-3 3.5-3 1.9 0 3 1.1 3 2.7 0 2-.9 3.7-2.3 3.7-.8 0-1.3-.6-1.1-1.4.2-.9.6-1.8.6-2.4 0-.6-.3-1-.9-1-.7 0-1.3.7-1.3 1.7 0 .6.2 1 .2 1l-.9 3.6c-.2 1-.04 2.3 0 2.4 0 .1.1.1.2.1.1-.1.8-1 1-1.9l.4-1.5c.2.4.9.8 1.6.8 2.1 0 3.6-1.9 3.6-4.5 0-2-1.7-3.8-4.3-3.8z" fill="#fff"/></svg>`,
  google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.6-.05-1.2-.16-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z" fill="#4285F4"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9z" fill="#FBBC05"/><path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z" fill="#EA4335"/></svg>`,
} as const;

export type BrandName = keyof typeof BRAND;

export const uiIcon = (name: string): string => (UI as Record<string, string>)[name] || UI.target;
export const brandIcon = (name: string): string => (BRAND as Record<string, string>)[name] || '';

export const ICONS = { ui: UI, brand: BRAND };
