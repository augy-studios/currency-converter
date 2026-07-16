const API_BASE = 'https://currency.uwuapps.org/api';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}

// Returns a flat map of lowercase currency code -> display name.
async function fetchCurrencies() {
  return fetchJson(`${API_BASE}/currencies`);
}

// Returns { date, [base]: { code: rate, ... } }
async function fetchRates(base) {
  return fetchJson(`${API_BASE}/rates?base=${encodeURIComponent(base)}`);
}

module.exports = { fetchCurrencies, fetchRates };
