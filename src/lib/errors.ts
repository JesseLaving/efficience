/** Map raw API errors to user-friendly French messages */
export function friendlyError(statusCode: number | string | null, rawMessage: string | null): string {
  const code = String(statusCode || '').trim().toUpperCase();
  const msg = (rawMessage || '').toLowerCase();

  // HTTP status codes
  if (code === '400' || msg.includes('bad request')) {
    return 'Erreur de formulation. Vérifiez les données envoyées.';
  }
  if (code === '401' || code === 'UNAUTHORIZED' || msg.includes('unauthorized') || msg.includes('invalid access token')) {
    return 'Session expirée ou identifiants invalides. Reconnectez-vous.';
  }
  if (code === '403' || code === 'FORBIDDEN' || msg.includes('permission') || msg.includes('privilege')) {
    return 'Accès refusé. Les autorisations requises ne sont pas validées par la plateforme.';
  }
  if (code === '404' || msg.includes('not found')) {
    return 'Ce réseau ou ce compte n\'existe plus. Reconnectez-vous ou vérifiez la configuration.';
  }
  if (code === '409' || msg.includes('conflict')) {
    return 'Conflit avec les données existantes. Rechargez et réessayez.';
  }
  if (code === '429' || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Trop de requêtes. Attendez quelques secondes et réessayez.';
  }
  if (code === '500' || code === '502' || code === '503' || msg.includes('server error') || msg.includes('service unavailable')) {
    return 'Le serveur de la plateforme est momentanément indisponible. Réessayez dans quelques instants.';
  }

  // Network errors
  if (msg.includes('network') || msg.includes('enotfound') || msg.includes('econnrefused')) {
    return 'Problème de connexion réseau. Vérifiez votre internet et réessayez.';
  }
  if (msg.includes('timeout') || msg.includes('deadline exceeded')) {
    return 'La requête a dépassé le délai imparti. Le serveur est peut-être surchargé.';
  }

  // Meta-specific errors
  if (msg.includes('invalid oauth token') || msg.includes('malformed access token')) {
    return 'Token Meta invalide. Reconnectez Instagram et Facebook.';
  }
  if (msg.includes('pages_manage_posts') || msg.includes('instagram_content_publish')) {
    return 'Ces autorisations (pages_manage_posts, instagram_content_publish) sont en attente de validation Meta App Review. En mode développeur, seul votre compte peut publier.';
  }
  if (msg.includes('media request failed') || msg.includes('instagram')) {
    return 'L\'image n\'a pas pu être traitée. Vérifiez l\'URL : elle doit être publique et accessible.';
  }

  // LinkedIn-specific errors
  if (msg.includes('invalid access token') && msg.includes('linkedin')) {
    return 'Token LinkedIn expiré. Reconnectez LinkedIn.';
  }
  if (msg.includes('linkedin')) {
    return 'Erreur LinkedIn. Vérifiez votre connexion et réessayez.';
  }

  // Google-specific errors
  if (msg.includes('google')) {
    if (msg.includes('invalid') || msg.includes('unauthorized')) {
      return 'Token Google expiré ou invalide. Reconnectez Google Business.';
    }
    return 'Erreur Google Business. Réessayez.';
  }

  // Generic fallback: shorten long messages, keep useful parts
  if (rawMessage && rawMessage.length > 100) {
    const shortened = rawMessage.slice(0, 120).trim();
    return shortened.endsWith('.') ? shortened : shortened + '…';
  }

  return rawMessage || 'Une erreur inattendue s\'est produite. Contactez le support si le problème persiste.';
}

/** Extract status code from various error shapes */
export function extractStatusCode(error: unknown): number | null {
  if (!error) return null;
  if (typeof error === 'number') return error;
  if (typeof error === 'string') {
    const match = error.match(/(\d{3})/);
    return match ? parseInt(match[1], 10) : null;
  }
  if (typeof error === 'object') {
    if ('status' in error) return (error as any).status;
    if ('statusCode' in error) return (error as any).statusCode;
    if ('code' in error && typeof (error as any).code === 'number') return (error as any).code;
  }
  return null;
}

/** Extract message from various error shapes */
export function extractMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object') {
    if ('message' in error) return String((error as any).message);
    if ('reason' in error) return String((error as any).reason);
    if ('error' in error) return String((error as any).error);
  }
  return null;
}
