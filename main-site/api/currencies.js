const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies.json',
  'https://latest.currency-api.pages.dev/v1/currencies.json',
];

export default async function handler(req, res) {
  for (const url of SOURCES) {
    try {
      const upstream = await fetch(url, { cache: 'no-store' });
      if (!upstream.ok) continue;
      const data = await upstream.json();
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json(data);
      return;
    } catch (err) {
      continue;
    }
  }
  res.status(502).json({ error: 'Failed to fetch currencies' });
}
