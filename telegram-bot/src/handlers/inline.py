import re
import uuid

from telethon.tl import functions, types

from .. import currency, db
from ..convert import build_conversion_view, compute_conversion

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
            parse_mode='md',
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
            parse_mode='md',
        )
        return await event.answer([result])

    preferred = db.get_preferences(user_id)
    if not preferred:
        result = builder.article(
            'No preferred currencies set',
            description='Message the bot directly and use /setpreferred first',
            text='You have not picked any preferred currencies yet. Message this bot directly and use /setpreferred first.',
            parse_mode='md',
        )
        return await event.answer([result])

    conversion = await compute_conversion(user_id, amount, code)
    interaction_id = db.create_interaction('convert', user_id, {'amount': amount, 'base': code})
    # No copy buttons: inline-mode messages can't carry them.
    rich, keyboard = build_conversion_view(conversion, interaction_id, False)

    title = f'{match.group(1)} {match.group(2).upper()} converted'
    summary = ', '.join(f"{r['code'].upper()}: {r['formatted']}" for r in conversion['results'])

    # Telethon's builder.article() can't carry a rich message, so build the
    # result and answer the query with raw TL objects instead.
    result = types.InputBotInlineResult(
        id=str(uuid.uuid4()),
        type='article',
        title=title,
        description=summary,
        send_message=types.InputBotInlineMessageRichMessage(
            rich_message=types.InputRichMessageMarkdown(markdown=rich['markdown']),
            reply_markup=event.client.build_reply_markup(keyboard),
        ),
    )
    try:
        await event.client(functions.messages.SetInlineBotResultsRequest(
            query_id=event.query.query_id, results=[result], cache_time=0,
        ))
    except Exception as err:
        print(f'[inline_handler] rich inline result failed, falling back: {err}')
        result = builder.article(
            title,
            description=summary,
            text=rich['fallback'],
            parse_mode=None,  # the fallback is plain text
            link_preview=False,
            buttons=keyboard,
            id=str(uuid.uuid4()),
        )
        await event.answer([result])
