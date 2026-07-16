from telethon.tl import types

from .. import currency, db
from ..edit_utils import safe_edit
from ..keyboards import remove_preferred_keyboard

INTRO = 'Tap a currency to remove it from your preferred list.'
EMPTY = 'You have no preferred currencies left.'


async def _preferred_currencies(user_id):
    all_currencies = await currency.list_currencies()
    preferred = set(db.get_preferences(user_id))
    return [c for c in all_currencies if c['code'] in preferred]


async def command(event):
    db.ensure_user(event.sender_id)
    currencies = await _preferred_currencies(event.sender_id)

    if not currencies:
        return await event.respond(
            'You have not picked any preferred currencies yet. Use /setpreferred first.'
        )

    interaction_id = db.create_interaction('removepref', event.sender_id, {'page': 0})
    keyboard = remove_preferred_keyboard(interaction_id, 0, currencies)
    await event.respond(INTRO, buttons=keyboard, parse_mode='md')


async def callback(event, parts):
    interaction_id = int(parts[1])
    action = parts[2]
    arg = parts[3] if len(parts) > 3 else None

    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'removepref':
        return await event.answer('This menu has expired. Run /removepreferred again.', alert=True)
    if interaction['user_id'] != event.sender_id:
        return await event.answer('This menu belongs to someone else.', alert=True)

    page = interaction['payload'].get('page', 0)

    if action == 'noop':
        return await event.answer()

    toast = None
    if action == 'page':
        page = int(arg)
        db.update_interaction(interaction_id, {'page': page})
    elif action == 'remove':
        db.remove_preference(event.sender_id, arg)
        toast = f'Removed {arg.upper()}'

    await event.answer(toast)

    currencies = await _preferred_currencies(event.sender_id)
    if not currencies:
        return await safe_edit(event, EMPTY, buttons=types.ReplyInlineMarkup(rows=[]), parse_mode='md')

    keyboard = remove_preferred_keyboard(interaction_id, page, currencies)
    await safe_edit(event, INTRO, buttons=keyboard, parse_mode='md')
