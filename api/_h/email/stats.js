/* Statistiques de campagne d'un espace : ouvertures, clics, plaintes, échecs et
   désinscriptions, par campagne. GET ?spaceId=…

   Les compteurs sont des destinataires DISTINCTS (voir la clé primaire de
   app_email_events) : un contact qui rouvre dix fois compte pour une. Rien
   n'est estimé ni extrapolé — une campagne sans événement remonte simplement
   absente, et l'interface affiche « — » plutôt qu'un zéro trompeur. */
import { cors, json } from './_shared.js';
import { requireSession } from '../requireSession.js';
import { getCampaignStats, query } from '../db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); res.statusCode = 204; res.end(); return; }
  if (req.method !== 'GET') return json(res, 405, { error: 'GET requis' });

  const session = requireSession(req, res, json);
  if (!session) return;

  const spaceId = parseInt(
    (req.query && req.query.spaceId) || new URL(req.url, 'http://x').searchParams.get('spaceId') || '',
    10,
  );
  if (!spaceId) return json(res, 400, { error: 'spaceId requis' });

  /* Cloisonnement : sans ce contrôle, un utilisateur authentifié pourrait lire
     les statistiques de l'espace d'un autre en changeant simplement le
     paramètre. */
  try {
    const { rows } = await query(
      `SELECT 1 FROM app_spaces WHERE id = $1 AND user_id = $2`,
      [spaceId, session.userId],
    );
    if (!rows.length) return json(res, 403, { error: 'Espace inaccessible' });
  } catch {
    return json(res, 500, { error: 'Vérification de l’espace impossible' });
  }

  return json(res, 200, { available: true, stats: await getCampaignStats(spaceId) });
}
