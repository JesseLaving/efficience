/* Concurrents réels & références nationales — même source publique que
   l'identité de l'entreprise (API "Recherche d'entreprises", INSEE/SIRENE,
   gratuite, sans clé). Deux requêtes : NAF + département → concurrents
   locaux ; NAF seul → références nationales (les résultats sans filtre
   géographique sont naturellement dominés par les plus grandes structures
   du secteur). Aucune donnée inventée, l'entreprise elle-même est exclue
   par SIREN. */

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

function normalize(r) {
  const siege = r.siege || {};
  return {
    nom: r.nom_complet || r.nom_raison_sociale || null,
    siren: r.siren || null,
    commune: siege.libelle_commune || null,
    departement: siege.departement || null,
    categorie: r.categorie_entreprise || null,
    effectif: r.tranche_effectif_salarie || null,
  };
}

async function search(naf, departement, excludeSiren, perPage) {
  const params = new URLSearchParams({ activite_principale: naf, per_page: String(perPage) });
  if (departement) params.set('departement', departement);
  const api = `https://recherche-entreprises.api.gouv.fr/search?${params.toString()}`;
  const r = await fetch(api, { headers: { 'User-Agent': 'Efficience/1.0' } });
  if (!r.ok) return [];
  const data = await r.json();
  return (data.results || [])
    .map(normalize)
    .filter((c) => c.siren !== excludeSiren)
    .slice(0, 6);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const naf = (getParam(req, 'naf') || '').trim();
  const departement = (getParam(req, 'departement') || '').trim();
  const excludeSiren = (getParam(req, 'excludeSiren') || '').trim() || null;
  if (!naf) return json(res, 400, { error: 'Paramètre "naf" requis (code NAF/APE, ex. 70.22Z).' });
  try {
    const [local, national] = await Promise.all([
      departement ? search(naf, departement, excludeSiren, 8) : Promise.resolve([]),
      search(naf, null, excludeSiren, 8),
    ]);
    return json(res, 200, { naf, departement: departement || null, local, national });
  } catch (e) {
    return json(res, 500, { error: 'Échec de la requête concurrents', detail: String(e && e.message || e) });
  }
}
