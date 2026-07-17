import aiohttp

API_BASE = 'https://api.currency.uwuapps.org'

_session = None


async def get_session():
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession()
    return _session


async def close_session():
    global _session
    if _session is not None and not _session.closed:
        await _session.close()


async def _fetch_json(url):
    session = await get_session()
    async with session.get(url, headers={'accept': 'application/json'}) as res:
        if res.status != 200:
            raise RuntimeError(f'Request to {url} failed with status {res.status}')
        return await res.json(content_type=None)


# Returns an array of {iso_code, iso_numeric, name, symbol, start_date, end_date}.
async def fetch_currencies():
    return await _fetch_json(f'{API_BASE}/v2/currencies')


# Returns [{date, base, quote, rate}, ...] for every quote currency against `base`.
async def fetch_rates(base):
    return await _fetch_json(f'{API_BASE}/v2/rates?base={base.upper()}')


# Returns [{date, base, quote, rate}, ...] flat rows across the date range,
# one row per date/quote pair. `quotes` is an iterable of currency codes.
async def fetch_history(base, quotes, date_from, date_to=None, group=None):
    quotes_param = ','.join(q.upper() for q in quotes)
    url = f'{API_BASE}/v2/rates?base={base.upper()}&quotes={quotes_param}&from={date_from}'
    if date_to:
        url += f'&to={date_to}'
    if group:
        url += f'&group={group}'
    return await _fetch_json(url)
