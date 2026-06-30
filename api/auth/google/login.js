/* Google OAuth — step 1: redirect to Google consent screen. */

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://efficience.vercel.app/api/auth/google/callback';

  if (!clientId) {
    res.statusCode = 500;
    res.end('GOOGLE_CLIENT_ID manquant');
    return;
  }

  const state = Buffer.from(JSON.stringify({ ret: req.query.return || '/' })).toString('base64url');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=${encodeURIComponent('openid profile email')}&` +
    `state=${encodeURIComponent(state)}`;

  res.statusCode = 302;
  res.setHeader('Location', url);
  res.end();
}
