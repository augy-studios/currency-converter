import json
import time
from datetime import date, timedelta

from . import api, db

CURRENCY_LIST_TTL_MS = 24 * 60 * 60 * 1000  # 24h, the list rarely changes
RATE_TTL_MS = 60 * 1000  # 60s, keeps rapid conversions from hammering the API

RANGE_DAYS = {'5d': 5, '1w': 7, '1m': 30, '1y': 365, '5y': 365 * 5}
RANGE_GROUP = {'1y': 'week', '5y': 'month', 'max': 'month'}
FALLBACK_START_DATE = '1999-01-04'


async def ensure_currency_list():
    last_fetched = int(db.get_meta('currencies_fetched_at') or 0)
    if int(time.time() * 1000) - last_fetched < CURRENCY_LIST_TTL_MS:
        return

    data = await api.fetch_currencies()
    entries = [
        (c['iso_code'].lower(), c['name'], c.get('symbol'), c.get('start_date'), c.get('end_date'))
        for c in data
    ]
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

    rows = await api.fetch_rates(code)
    if not rows:
        raise RuntimeError(f'No rate data returned for base currency "{base}"')
    rate_date = rows[0]['date']
    rates = {r['quote'].lower(): r['rate'] for r in rows}
    db.set_rates_cache(code, rate_date, rates)
    return {'date': rate_date, 'rates': rates}


def _compute_from_date(range_key, base_code, quote_codes):
    if range_key == 'max':
        starts = []
        for c in (base_code, *quote_codes):
            meta = db.get_currency(c.lower())
            if meta and meta['start_date']:
                starts.append(meta['start_date'])
        return max(starts) if starts else FALLBACK_START_DATE

    days = RANGE_DAYS.get(range_key, RANGE_DAYS['1m'])
    return (date.today() - timedelta(days=days)).isoformat()


# Returns [{date, base, quote, rate}, ...] flat rows for the requested range.
async def get_history(base, quotes, range_key):
    await ensure_currency_list()
    date_from = _compute_from_date(range_key, base, quotes)
    group = RANGE_GROUP.get(range_key)
    return await api.fetch_history(base, quotes, date_from, group=group)
