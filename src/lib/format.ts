export const fr = (n: number | string): string => Number(n).toLocaleString('fr-FR');

/** Relative timestamp ("à l’instant", "il y a 5 min", "il y a 2 h"). */
export function timeAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 10) return 'à l’instant';
  if (s < 60) return `il y a ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

export const PCT = (v: number): string => v.toFixed(1).replace('.', ',') + ' %';

/** KPI value formatters, mirroring the prototype's FMT table. */
export const FMT: Record<string, (v: number) => string> = {
  int: (v) => fr(Math.round(v)),
  pct: (v) => v.toFixed(1).replace('.', ',') + ' %',
  eur: (v) => (Math.abs(v) >= 1000 ? fr(Math.round(v)) : v.toFixed(v % 1 ? 1 : 0).replace('.', ',')) + ' €',
  rating: (v) => v.toFixed(1).replace('.', ','),
  min: (v) => v.toFixed(0) + ' min',
};

export const UNIT: Record<string, string> = { rating: '/5' };
