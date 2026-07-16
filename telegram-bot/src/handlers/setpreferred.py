from .. import currency, db
from ..edit_utils import safe_edit
from ..keyboards import set_preferred_keyboard

INTRO = (
    'Pick the currencies you would like to see (you can select more than one - tap to toggle).'
)


async def command(event):
    db.ensure_user(event.sender_id)
    interaction_id = db.create_interaction('setpref', event.sender_id, {'page': 0})
    currencies = await currency.list_currencies()
    preferred = set(db.get_preferences(event.sender_id))
    keyboard = set_preferred_keyboard(interaction_id, 0, currencies, preferred)
    await event.respond(INTRO, buttons=keyboard, parse_mode='md')


async def callback(event, parts):
    interaction_id = int(parts[1])
    action = parts[2]
    arg = parts[3] if len(parts) > 3 else None

    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'setpref':
        return await event.answer('This menu has expired. Run /setpreferred again.', alert=True)
    if interaction['user_id'] != event.sender_id:
        return await event.answer('This menu belongs to someone else.', alert=True)

    page = interaction['payload'].get('page', 0)

    if action == 'noop':
        return await event.answer()

    toast = None
    if action == 'page':
        page = int(arg)
        db.update_interaction(interaction_id, {'page': page})
    elif action == 'toggle':
        now_selected = db.toggle_preference(event.sender_id, arg)
        toast = f'Added {arg.upper()}' if now_selected else f'Removed {arg.upper()}'
    elif action == 'clear':
        db.clear_preferences(event.sender_id)
        page = int(arg) if arg is not None else 0
        toast = 'Cleared all preferred currencies.'

    await event.answer(toast)

    currencies = await currency.list_currencies()
    preferred = set(db.get_preferences(event.sender_id))
    keyboard = set_preferred_keyboard(interaction_id, page, currencies, preferred)
    await safe_edit(event, INTRO, buttons=keyboard, parse_mode='md')
