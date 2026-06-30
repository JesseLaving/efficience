/* Google OAuth — step 2: exchange code for token and create session. */
import { sql } from '@vercel/postgres';

async function getOrCreateUser(googleId, email, name) {
  try {
    const { rows } = await sql`
      SELECT id, google_id, email, name FROM users WHERE google_id = ${googleId}
    `;

    if (rows.length > 0) {
      return rows[0];
    }

    // Create new user
    const insertResult = await sql`
      INSERT INTO users (google_id, email, name) VALUES (${googleId}, ${email}, ${name})
      RETURNING id, google_id, email, name
    `;
    return insertResult.rows[0];
  } catch (e) {
    console.error('User lookup/create error:', e);
    throw e;
  }
}

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) {
    res.statusCode = 400;
    res.end('Code manquant');
    return;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://efficience.vercel.app/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      res.statusCode = 500;
      res.end('Google credentials manquants');
      return;
    }

    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      res.statusCode = 400;
      res.end('Token exchange failed: ' + (tokenData.error || 'unknown'));
      return;
    }

    // Get user info from Google
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await infoRes.json();
    if (!userInfo.id) {
      res.statusCode = 400;
      res.end('Failed to get user info');
      return;
    }

    // Get or create user in DB
    const user = await getOrCreateUser(userInfo.id, userInfo.email, userInfo.name);

    // Create session token (simple JWT-like, in reality use a proper lib)
    const sessionToken = Buffer.from(JSON.stringify({
      userId: user.id,
      googleId: userInfo.id,
      email: userInfo.email,
      iat: Date.now(),
    })).toString('base64');

    // Set cookie
    res.setHeader('Set-Cookie', `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`);

    // Redirect to dashboard
    const returnUrl = state ? JSON.parse(Buffer.from(state, 'base64url').toString()).ret : '/';
    res.statusCode = 302;
    res.setHeader('Location', returnUrl);
    res.end();
  } catch (e) {
    console.error('Auth callback error:', e);
    res.statusCode = 500;
    res.end('Authentication failed');
  }
}
