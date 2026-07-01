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

// Common légal forms (nature juridique INSEE) — public reference, fallback to code.
const NJ = {
  '1000': 'Entrepreneur individuel',
  '5202': 'Société en nom collectif',
  '5410': 'SARL nationale',
  '5499': 'Société à responsabilité limitée (SARL)',
  '5599': 'Société anonyme (SA)',
  '5710': 'Société par actions simplifiée (SAS)',
  '5720': 'Société par actions simplifiée à associé unique (SASU)',
  '5785': 'Société d’exercice libéral par actions simplifiée (SELAS)',
  '6540': 'Société civile immobilière (SCI)',
  '6901': 'Autre personne morale de droit privé',
  '9220': 'Association déclarée',
};
const tranche = (code) => ({
  NN: 'Non renseigné', '00': '0 salarié', '01': '1 à 2 salariés', '02': '3 à 5 salariés',
  '03': '6 à 9 salariés', '11': '10 à 19 salariés', '12': '20 à 49 salariés',
  '21': '50 à 99 salariés', '22': '100 à 199 salariés', '31': '200 à 249 salariés',
  '32': '250 à 499 salariés', '41': '500 à 999 salariés', '42': '1000 à 1999 salariés',
}[code] || code || null);

function normalize(r) {
  const siege = r.siege || {};
  const c = r.complements || {};
  const nafCode = r.activite_principale || siege.activite_principale || null;
  const njCode = r.nature_juridique || null;
  const finances = r.finances && typeof r.finances === 'object'
    ? Object.keys(r.finances).sort((a, b) => b.localeCompare(a)).slice(0, 3).map((y) => ({
        annee: y, ca: r.finances[y].ca ?? null, resultatNet: r.finances[y].resultat_net ?? null,
      }))
    : null;
  return {
    nom: r.nom_complet || r.nom_raison_sociale || null,
    sigle: r.sigle || null,
    siren: r.siren || null,
    siret: siege.siret || null,
    naf: { code: nafCode,
           libelle: r.libelle_activite_principale || siege.libelle_activite_principale || (nafCode ? NAF[nafCode] : null) || null },
    formeJuridique: njCode,
    formeJuridiqueLabel: njCode ? (NJ[njCode] || null) : null,
    categorie: r.categorie_entreprise || null,
    dateCreation: r.date_creation || null,
    dateMaj: r.date_mise_a_jour || null,
    etatAdministratif: r.etat_administratif || siege.etat_administratif || null,
    effectif: tranche(r.tranche_effectif_salarie),
    effectifAnnee: r.annee_tranche_effectif_salarie || null,
    employeur: r.caractere_employeur === 'O' ? true : r.caractere_employeur === 'N' ? false : null,
    commune: siege.libelle_commune || null,
    codePostal: siege.code_postal || null,
    adresse: siege.geo_adresse || siege.adresse || null,
    region: siege.region || null,
    enseigne: (siege.liste_enseignes && siege.liste_enseignes[0]) || siege.nom_commercial || null,
    nda: (c.liste_id_organisme_formation && c.liste_id_organisme_formation[0]) || null,
    badges: {
      organismeFormation: !!c.est_organisme_formation,
      qualiopi: !!c.est_qualiopi,
      ess: !!c.est_ess,
      rge: !!c.est_rge,
      bio: !!c.est_bio,
      association: !!c.est_association,
      entrepreneurIndividuel: !!c.est_entrepreneur_individuel,
      societeMission: !!c.est_societe_mission,
    },
    dirigeants: (r.dirigeants || []).map((d) => ({
      nom: [d.prenoms, d.nom].filter(Boolean).join(' ') || d.denomination || null,
      qualite: d.qualite || null,
      anneeNaissance: d.annee_de_naissance || null,
      type: d.type_dirigeant || null,
    })).filter((d) => d.nom),
    finances,
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
