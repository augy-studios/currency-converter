// Exchange rates the tests answer with, for the site (tests/site.spec.js) and the app's browser
// build (the other specs): the site's /api/currencies, /api/rates and /api/history, as the
// self-hosted Frankfurter API shapes them (main-site/api/*.js). Fixed numbers, so every run and
// every screenshot shows the same.

export const CURRENCIES = [
  { iso_code: "SGD", iso_numeric: "702", name: "Singapore Dollar", symbol: "S$", start_date: "1999-01-04", end_date: null },
  { iso_code: "MYR", iso_numeric: "458", name: "Malaysian Ringgit", symbol: "RM", start_date: "1999-01-04", end_date: null },
  { iso_code: "USD", iso_numeric: "840", name: "United States Dollar", symbol: "$", start_date: "1999-01-04", end_date: null },
  { iso_code: "EUR", iso_numeric: "978", name: "Euro", symbol: "€", start_date: "1999-01-04", end_date: null },
  { iso_code: "JPY", iso_numeric: "392", name: "Japanese Yen", symbol: "¥", start_date: "1999-01-04", end_date: null },
  { iso_code: "GBP", iso_numeric: "826", name: "British Pound", symbol: "£", start_date: "1999-01-04", end_date: null },
  { iso_code: "AUD", iso_numeric: "036", name: "Australian Dollar", symbol: "A$", start_date: "1999-01-04", end_date: null },
  { iso_code: "IDR", iso_numeric: "360", name: "Indonesian Rupiah", symbol: "Rp", start_date: "1999-01-04", end_date: null },
];

// Units of each currency to one US dollar.
const PER_USD = { USD: 1, SGD: 1.3, MYR: 4.25, EUR: 0.86, JPY: 154.2, GBP: 0.76, AUD: 1.53, IDR: 16650 };

export const RATE_DATE = "2026-11-13";

export function rate(base, quote) {
  return Number((PER_USD[quote] / PER_USD[base]).toFixed(6));
}

export function ratesFor(base) {
  return Object.keys(PER_USD)
    .filter((q) => q !== base)
    .map((quote) => ({ date: RATE_DATE, base, quote, rate: rate(base, quote) }));
}

// A gentle wave over the dates asked for, a different one per currency, so the graph has shape.
export function historyFor(base, quotes, from) {
  const rows = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${RATE_DATE}T00:00:00Z`);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const step = Math.max(1, Math.ceil(days / 120));
  for (let d = 0; d <= days; d += step) {
    const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    // A drift and a couple of slow swells across the range, whatever its length, with a little
    // day-to-day wobble, so every range looks like a rate rather than a sine wave.
    const f = d / days;
    quotes.forEach((quote, i) => {
      const wave = 1 + 0.025 * Math.sin(f * Math.PI * (1.4 + i * 0.5) + i) + 0.01 * Math.sin(f * Math.PI * 6 + i * 2) + 0.003 * Math.sin(d * 1.7 + i) - 0.02 * f * (i % 2 ? -1 : 1);
      rows.push({ date, base, quote, rate: Number((rate(base, quote) * wave).toFixed(6)) });
    });
  }
  return rows;
}

// Answers /api/* wherever it's asked: the site's own origin, or currency.uwuapps.org from the app.
export async function routeApi(target) {
  await target.route(/\/api\/(currencies|rates|history)(\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (url.pathname.endsWith("/currencies")) return json(CURRENCIES);
    const base = (url.searchParams.get("base") || "").toUpperCase();
    if (url.pathname.endsWith("/rates")) return json(ratesFor(base));
    const quotes = (url.searchParams.get("quotes") || "").toUpperCase().split(",").filter(Boolean);
    return json(historyFor(base, quotes, url.searchParams.get("from") || "2026-10-13"));
  });
}
