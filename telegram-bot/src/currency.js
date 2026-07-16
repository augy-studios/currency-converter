const api = require('./api');
const db = require('./db');

const CURRENCY_LIST_TTL_MS = 24 * 60 * 60 * 1000; // 24h, the list rarely changes
const RATE_TTL_MS = 60 * 1000; // 60s, keeps rapid conversions from hammering the API

async function ensureCurrencyList() {
  const lastFetched = Number(db.getMeta('currencies_fetched_at') || 0);
  if (Date.now() - lastFetched < CURRENCY_LIST_TTL_MS) return;

  const data = await api.fetchCurrencies();
  const entries = Object.entries(data).map(([code, name]) => [code.toLowerCase(), name]);
  db.replaceCurrencies(entries);
  db.setMeta('currencies_fetched_at', String(Date.now()));
}

async function getCurrencyName(code) {
  await ensureCurrencyList();
  const row = db
    .getAllCurrencies()
    .find((c) => c.code === code.toLowerCase());
  return row ? row.name : null;
}

async function isValidCurrency(code) {
  await ensureCurrencyList();
  return db.currencyExists(code.toLowerCase());
}

async function listCurrencies() {
  await ensureCurrencyList();
  return db.getAllCurrencies();
}

// Returns { date, rates: { code: rate, ... } } for the given base, using a
// short SQLite-backed cache. Pass force=true (e.g. from a Refresh button) to
// bypass the cache and hit the API live.
async function getRates(base, { force = false } = {}) {
  const code = base.toLowerCase();
  if (!force) {
    const cached = db.getRatesCache(code);
    if (cached && Date.now() - cached.fetched_at < RATE_TTL_MS) {
      const parsed = JSON.parse(cached.data);
      return { date: cached.date, rates: parsed };
    }
  }

  const data = await api.fetchRates(code);
  const rates = data[code];
  if (!rates) {
    throw new Error(`No rate data returned for base currency "${base}"`);
  }
  db.setRatesCache(code, data.date, rates);
  return { date: data.date, rates };
}

module.exports = {
  ensureCurrencyList,
  getCurrencyName,
  isValidCurrency,
  listCurrencies,
  getRates,
};
