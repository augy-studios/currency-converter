import crypto from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const GUEST_TTL_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_KEY' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Same-origin fetches sometimes arrive with no Origin header at all — that's normal, allow it.
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }

  const appId = String(req.query.app_id || 'unknown');
  const sessionToken = crypto.randomUUID();
  const signingKey = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + GUEST_TTL_MS).toISOString();

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/uwu_signing_keys`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      session_token: sessionToken,
      signing_key: signingKey,
      is_guest: true,
      app_id: appId,
      expires_at: expiresAt,
    }),
  });

  if (!insertRes.ok) {
    res.status(502).json({ error: 'Failed to issue guest key' });
    return;
  }

  res.status(200).json({ key_id: sessionToken, signing_key: signingKey });
}
