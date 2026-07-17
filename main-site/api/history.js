const UPSTREAM = 'https://api.currency.uwuapps.org/v2/rates';

const CODE_RE = /^[A-Z0-9]{2,10}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  const base = String(req.query.base || '').toUpperCase();
  const quotes = String(req.query.quotes || '').toUpperCase();
  const from = String(req.query.from || '');
  const to = req.query.to ? String(req.query.to) : '';
  const group = req.query.group ? String(req.query.group) : '';

  const quoteCodes = quotes.split(',').filter(Boolean);

  if (!CODE_RE.test(base)) {
    res.status(400).json({ error: 'Invalid base currency' });
    return;
  }
  if (!quoteCodes.length || !quoteCodes.every((c) => CODE_RE.test(c))) {
    res.status(400).json({ error: 'Invalid quotes' });
    return;
  }
  if (!DATE_RE.test(from)) {
    res.status(400).json({ error: 'Invalid from date' });
    return;
  }
  if (to && !DATE_RE.test(to)) {
    res.status(400).json({ error: 'Invalid to date' });
    return;
  }
  if (group && !['week', 'month'].includes(group)) {
    res.status(400).json({ error: 'Invalid group' });
    return;
  }

  const url = new URL(UPSTREAM);
  url.searchParams.set('base', base);
  url.searchParams.set('quotes', quoteCodes.join(','));
  url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  if (group) url.searchParams.set('group', group);

  try {
    const upstream = await fetch(url, { cache: 'no-store' });
    if (!upstream.ok) throw new Error(`status ${upstream.status}`);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch history' });
  }
}
