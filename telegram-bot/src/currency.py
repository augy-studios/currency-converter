import json
import time

from . import api, db

CURRENCY_LIST_TTL_MS = 24 * 60 * 60 * 1000  # 24h, the list rarely changes
RATE_TTL_MS = 60 * 1000  # 60s, keeps rapid conversions from hammering the API


async def ensure_currency_list():
    last_fetched = int(db.get_meta('currencies_fetched_at') or 0)
    if int(time.time() * 1000) - last_fetched < CURRENCY_LIST_TTL_MS:
        return

    data = await api.fetch_currencies()
    entries = [(code.lower(), name) for code, name in data.items()]
    db.replace_currencies(entries)
    db.set_meta('currencies_fetched_at', str(int(time.time() * 1000)))


async def is_valid_currency(code):
    await ensure_currency_list()
    return db.currency_exists(code.lower())


async def list_currencies():
    await ensure_currency_list()
    return db.get_all_currencies()


# Returns {"date": ..., "rates": {code: rate, ...}} for the given base, using
# a short SQLite-backed cache. Pass force=True (e.g. from a Refresh button)
# to bypass the cache and hit the API live.
async def get_rates(base, force=False):
    code = base.lower()
    if not force:
        cached = db.get_rates_cache(code)
        if cached and int(time.time() * 1000) - cached['fetched_at'] < RATE_TTL_MS:
            return {'date': cached['date'], 'rates': json.loads(cached['data'])}

    data = await api.fetch_rates(code)
    rates = data.get(code)
    if rates is None:
        raise RuntimeError(f'No rate data returned for base currency "{base}"')
    db.set_rates_cache(code, data['date'], rates)
    return {'date': data['date'], 'rates': rates}
