import re
import uuid

from .. import currency, db
from ..convert import build_conversion_message, compute_conversion
from ..keyboards import convert_keyboard

AMOUNT_CODE_RE = re.compile(r'^(-?\d+(?:\.\d+)?)\s+([A-Za-z]{2,10})$')


async def inline_handler(event):
    query = (event.text or '').strip()
    user_id = event.query.user_id
    db.ensure_user(user_id)
    builder = event.builder

    match = AMOUNT_CODE_RE.match(query)
    if not match:
        result = builder.article(
            'Type an amount and currency code',
            description='Example: 12 USD',
            text='Type an amount and a currency code to convert, for example: 12 USD',
        )
        return await event.answer([result])

    amount = float(match.group(1))
    code = match.group(2).lower()

    valid = await currency.is_valid_currency(code)
    if not valid:
        result = builder.article(
            f'Unknown currency: {match.group(2).upper()}',
            description='Check the currency code and try again',
            text=f'Unknown currency code: {match.group(2).upper()}',
        )
        return await event.answer([result])

    preferred = db.get_preferences(user_id)
    if not preferred:
        result = builder.article(
            'No preferred currencies set',
            description='Message the bot directly and use /setpreferred first',
            text='You have not picked any preferred currencies yet. Message this bot directly and use /setpreferred first.',
        )
        return await event.answer([result])

    conversion = await compute_conversion(user_id, amount, code)
    text = build_conversion_message(conversion)
    interaction_id = db.create_interaction('convert', user_id, {'amount': amount, 'base': code})
    keyboard = convert_keyboard(interaction_id, conversion['results'], False)

    summary = ', '.join(f"{r['code'].upper()}: {r['formatted']}" for r in conversion['results'])
    result = builder.article(
        f'{match.group(1)} {match.group(2).upper()} converted',
        description=summary,
        text=text,
        parse_mode='md',
        link_preview=False,
        buttons=keyboard,
        id=str(uuid.uuid4()),
    )
    await event.answer([result])
