import aiohttp

API_BASE = 'https://currency.uwuapps.org/api'

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


# Returns a flat map of lowercase currency code -> display name.
async def fetch_currencies():
    return await _fetch_json(f'{API_BASE}/currencies')


# Returns { "date": ..., base: { code: rate, ... } }
async def fetch_rates(base):
    return await _fetch_json(f'{API_BASE}/rates?base={base}')

