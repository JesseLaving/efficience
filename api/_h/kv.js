/* Wrapper minimal pour Vercel KV / Upstash Redis via l'API REST (fetch),
   sans dépendance npm. Dégrade proprement si le store n'est pas provisionné. */
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const kvConfigured = () => !!(URL && TOKEN);

async function cmd(args) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || (d && d.error)) throw new Error((d && d.error) || `KV HTTP ${r.status}`);
  return d.result;
}

export const kvSet = (k, v) => cmd(['SET', k, typeof v === 'string' ? v : JSON.stringify(v)]);
export const kvDel = (k) => cmd(['DEL', k]);
export const kvKeys = (pattern) => cmd(['KEYS', pattern]);
export async function kvGetJson(k) {
  const r = await cmd(['GET', k]);
  if (r == null) return null;
  try { return JSON.parse(r); } catch { return null; }
}
