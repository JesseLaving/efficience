export const fr = (n: number | string): string => Number(n).toLocaleString('fr-FR');

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
