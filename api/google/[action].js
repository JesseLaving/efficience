/* Single Vercel function routing all /api/google/* actions. */
import login from '../_h/google/login.js';
import authlogin from '../_h/google/authlogin.js';
import callback from '../_h/google/callback.js';
import refresh from '../_h/google/refresh.js';
import accounts from '../_h/google/accounts.js';
import post from '../_h/google/post.js';
import contactslogin from '../_h/google/contactslogin.js';
import contactsfetch from '../_h/google/contactsfetch.js';
import youtubelogin from '../_h/google/youtubelogin.js';
import youtubechannel from '../_h/google/youtubechannel.js';
import youtubeupload from '../_h/google/youtubeupload.js';
import calendarlogin from '../_h/google/calendarlogin.js';
import calendarcreate from '../_h/google/calendarcreate.js';
import calendarsync from '../_h/google/calendarsync.js';

const MAP = {
  login, authlogin, callback, refresh, accounts, post, contactslogin, contactsfetch,
  youtubelogin, youtubechannel, youtubeupload, calendarlogin, calendarcreate, calendarsync,
};

export default function handler(req, res) {
  let action = req.query && req.query.action;
  if (!action) { try { action = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean).pop(); } catch { /* ignore */ } }
  const h = MAP[action];
  if (!h) { res.statusCode = 404; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: `google action inconnue: ${action}` })); return; }
  return h(req, res);
}
