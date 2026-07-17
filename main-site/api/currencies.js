const UPSTREAM = 'https://api.currency.uwuapps.org/v2/currencies';

export default async function handler(req, res) {
  try {
    const upstream = await fetch(UPSTREAM, { cache: 'no-store' });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch currencies' });
  }
}
