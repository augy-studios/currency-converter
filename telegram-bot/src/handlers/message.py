import re

from .. import currency, db, pending_rate
from ..convert import send_conversion
from ..format import code

AMOUNT_CODE_RE = re.compile(r'^(-?\d+(?:\.\d+)?)\s+([A-Za-z]{2,10})$')
BARE_CODE_RE = re.compile(r'^([A-Za-z]{2,10})$')


async def message_handler(event):
    text = (event.raw_text or '').strip()
    db.ensure_user(event.sender_id)

    amount_match = AMOUNT_CODE_RE.match(text)
    if amount_match:
        pending_rate.consume(event.sender_id)
        return await _handle_convert(event, float(amount_match.group(1)), amount_match.group(2))

    bare_match = BARE_CODE_RE.match(text)
    if bare_match and pending_rate.consume(event.sender_id):
        return await _handle_convert(event, 1, bare_match.group(1))

    # Not a recognised format, and not something we're expecting - stay quiet
    # rather than nagging on every unrelated message in a group chat.


async def _handle_convert(event, amount, raw_code):
    currency_code = raw_code.lower()
    valid = await currency.is_valid_currency(currency_code)
    if not valid:
        return await event.respond(
            f"I don't recognise the currency {code(currency_code.upper())}. Check the code and try again.",
            parse_mode='md',
        )
    await send_conversion(event, event.sender_id, amount, currency_code)
