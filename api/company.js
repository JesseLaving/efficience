/* Serverless function — real company analysis.
   Source: API "Recherche d'entreprises" (annuaire-entreprises / data.gouv) —
   free, no key, real INSEE/SIRENE data. Runs on Vercel and via the Vite dev
   middleware. No data is invented: we only normalize what the API returns. */

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

// Official NAF/APE labels (public INSEE reference) used only as a fallback
// when the API omits libelle_activite_principale.
const NAF = {
  '70.22Z': 'Conseil pour les affaires et autres conseils de gestion',
  '70.10Z': 'Activités des sièges sociaux',
  '85.59A': 'Formation continue d’adultes',
  '85.59B': 'Autres enseignements',
  '73.20Z': 'Études de marché et sondages',
  '73.11Z': 'Activités des agences de publicité',
  '63.12Z': 'Portails Internet',
  '82.99Z': 'Autres activités de soutien aux entreprises n.c.a.',
  '74.90B': 'Activités spécialisées, scientifiques et techniques diverses',
};

function normalize(r) {
  const siege = r.siege || {};
  const nafCode = r.activite_principale || siege.activite_principale || null;
  return {
    nom: r.nom_complet || r.nom_raison_sociale || null,
    sigle: r.sigle || null,
    siren: r.siren || null,
    siret: siege.siret || null,
    naf: { code: nafCode,
           libelle: r.libelle_activite_principale || siege.libelle_activite_principale || (nafCode ? NAF[nafCode] : null) || null },
    formeJuridique: r.nature_juridique || null,
    dateCreation: r.date_creation || null,
    etatAdministratif: r.etat_administratif || siege.etat_administratif || null,
    effectif: r.tranche_effectif_salarie || null,
    commune: siege.libelle_commune || null,
    codePostal: siege.code_postal || null,
    adresse: siege.adresse || null,
    dirigeants: (r.dirigeants || []).map((d) => ({
      nom: [d.prenoms, d.nom].filter(Boolean).join(' ') || d.denomination || null,
      qualite: d.qualite || null,
    })).filter((d) => d.nom),
    nombreEtablissements: r.nombre_etablissements_ouverts != null ? r.nombre_etablissements_ouverts : null,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  const q = (getParam(req, 'q') || '').trim();
  if (!q) return json(res, 400, { error: 'Paramètre "q" requis (nom ou SIREN/SIRET).' });
  try {
    const api = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=5`;
    const r = await fetch(api, { headers: { 'User-Agent': 'Efficience/1.0' } });
    if (!r.ok) return json(res, 502, { error: `API entreprises: HTTP ${r.status}` });
    const data = await r.json();
    const results = (data.results || []).map(normalize);
    return json(res, 200, { query: q, total: data.total_results || 0, results });
  } catch (e) {
    return json(res, 500, { error: 'Échec de la requête entreprises', detail: String(e && e.message || e) });
  }
}
