import { verifySignedRequest } from '../lib/uwu-request-signing-server.js';

const SOURCES = [
  (base) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base}.json`,
  (base) => `https://latest.currency-api.pages.dev/v1/currencies/${base}.json`,
];

export default async function handler(req, res) {
  const verification = await verifySignedRequest(req);
  if (!verification.valid) {
    res.status(403).json({ error: verification.reason });
    return;
  }

  const base = String(req.query.base || '').toLowerCase();
  if (!/^[a-z0-9-]{2,10}$/.test(base)) {
    res.status(400).json({ error: 'Invalid base currency' });
    return;
  }

  for (const buildUrl of SOURCES) {
    try {
      const upstream = await fetch(buildUrl(base), { cache: 'no-store' });
      if (!upstream.ok) continue;
      const data = await upstream.json();
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json(data);
      return;
    } catch (err) {
      continue;
    }
  }
  res.status(502).json({ error: 'Failed to fetch rates' });
}
