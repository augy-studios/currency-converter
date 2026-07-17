const UPSTREAM = 'https://api.currency.uwuapps.org/v2/rates';

export default async function handler(req, res) {
  const base = String(req.query.base || '').toUpperCase();
  if (!/^[A-Z0-9]{2,10}$/.test(base)) {
    res.status(400).json({ error: 'Invalid base currency' });
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}?base=${base}`, { cache: 'no-store' });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch rates' });
  }
}
