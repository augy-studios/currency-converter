/* Shared HMAC request-signing verification for UwU PWAs (server).
   Uses raw Supabase REST calls via fetch — no @supabase/supabase-js dependency. */

import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLOCK_SKEW_MS = 30 * 1000;

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function hmacHex(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

function timingSafeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Vercel's body parser sets req.body = {} for GET/DELETE even with no body sent.
// Treat that the same as "no body" so client and server agree on the hash.
function isEmptyBody(req) {
  const body = req.body;
  if (body == null) return true;
  if (typeof body === 'string') return body === '' || body === '{}';
  return Object.keys(body).length === 0;
}

export async function verifySignedRequest(req) {
  const token = req.headers['x-request-token'];
  const ts = req.headers['x-request-ts'];
  const keyIdHeader = req.headers['x-key-id'];
  const authHeader = req.headers['authorization'];

  if (!token || !ts) return { valid: false, reason: 'missing signature headers' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > CLOCK_SKEW_MS) {
    return { valid: false, reason: 'stale timestamp' };
  }

  const sessionToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : keyIdHeader;
  if (!sessionToken) return { valid: false, reason: 'missing key id' };

  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/uwu_signing_keys?session_token=eq.${encodeURIComponent(sessionToken)}&select=signing_key,expires_at`,
    { headers: restHeaders() }
  );
  if (!lookupRes.ok) return { valid: false, reason: 'signing key lookup failed' };
  const rows = await lookupRes.json();
  const row = rows[0];
  if (!row) return { valid: false, reason: 'unknown signing key' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { valid: false, reason: 'signing key expired' };

  const method = req.method.toUpperCase();
  const path = req.url.split('?')[0];
  const bodyHash = isEmptyBody(req) ? 'empty' : hmacHex(row.signing_key, JSON.stringify(req.body));
  const message = `${ts}:${method}:${path}:${bodyHash}`;
  const expectedToken = hmacHex(row.signing_key, message);

  if (!timingSafeEqualHex(token, expectedToken)) return { valid: false, reason: 'signature mismatch' };

  const usedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/uwu_used_request_tokens?token=eq.${encodeURIComponent(token)}&select=token`,
    { headers: restHeaders() }
  );
  const usedRows = usedRes.ok ? await usedRes.json() : [];
  if (usedRows.length > 0) return { valid: false, reason: 'replay detected' };

  await fetch(`${SUPABASE_URL}/rest/v1/uwu_used_request_tokens`, {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ token, session_token: sessionToken, used_at: new Date().toISOString() }),
  });

  return { valid: true, reason: 'ok' };
}
