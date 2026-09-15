import re

from .. import currency, db, pending_setpref
from ..edit_utils import clear_buttons, safe_edit, safe_edit_message
from ..format import code
from ..keyboards import set_preferred_keyboard

INTRO = (
    'Pick the currencies you would like to see (you can select more than one - tap to toggle).\n'
    'Or just type the codes here, e.g. `USD EUR JPY`, to add them without scrolling.\n'
    'Tap ⭐ Show Preferred to review and remove ones you picked, or ✅ Done when finished.'
)

# One or more currency codes separated by spaces and/or commas: "usd", "USD EUR", "usd, eur, gbp".
CODES_RE = re.compile(r'^[A-Za-z]{2,10}(?:[\s,]+[A-Za-z]{2,10})*$')


def _done_text(preferred):
    if not preferred:
        return 'No preferred currencies set. Run /setpreferred to pick some.'
    codes = ', '.join(sorted(c.upper() for c in preferred))
    return f'Saved your preferred currencies: {codes}'


async def command(event):
    db.ensure_user(event.sender_id)
    interaction_id = db.create_interaction('setpref', event.sender_id, {'page': 0, 'show_preferred': False})
    currencies = await currency.list_currencies()
    preferred = set(db.get_preferences(event.sender_id))
    keyboard = set_preferred_keyboard(interaction_id, 0, currencies, preferred)
    message = await event.respond(INTRO, buttons=keyboard, parse_mode='md')

    # Remember where the menu is so typed codes can refresh its ✅ marks, and
    # arm typing for this user in this chat.
    db.update_interaction(
        interaction_id,
        {'page': 0, 'show_preferred': False, 'chat_id': message.chat_id, 'message_id': message.id},
    )
    pending_setpref.mark(event.sender_id, interaction_id)


async def callback(event, parts):
    interaction_id = int(parts[1])
    action = parts[2]
    arg = parts[3] if len(parts) > 3 else None

    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'setpref':
        return await event.answer('This menu has expired. Run /setpreferred again.', alert=True)
    if interaction['user_id'] != event.sender_id:
        return await event.answer('This menu belongs to someone else.', alert=True)

    payload = interaction['payload']
    page = payload.get('page', 0)
    show_preferred = payload.get('show_preferred', False)

    if action == 'noop':
        return await event.answer()

    if action == 'done':
        pending_setpref.clear(event.sender_id, interaction_id)
        preferred = set(db.get_preferences(event.sender_id))
        await event.answer('Saved')
        return await clear_buttons(event, _done_text(preferred), parse_mode='md')

    toast = None
    if action == 'page':
        page = int(arg)
        db.update_interaction(interaction_id, {**payload, 'page': page, 'show_preferred': show_preferred})
    elif action == 'toggle':
        now_selected = db.toggle_preference(event.sender_id, arg)
        toast = f'Added {arg.upper()}' if now_selected else f'Removed {arg.upper()}'
    elif action == 'showpref':
        show_preferred = True
        page = 0
        db.update_interaction(interaction_id, {**payload, 'page': page, 'show_preferred': show_preferred})
    elif action == 'showall':
        show_preferred = False
        page = 0
        db.update_interaction(interaction_id, {**payload, 'page': page, 'show_preferred': show_preferred})

    await event.answer(toast)

    currencies = await currency.list_currencies()
    preferred = set(db.get_preferences(event.sender_id))
    keyboard = set_preferred_keyboard(interaction_id, page, currencies, preferred, show_preferred)
    await safe_edit(event, INTRO, buttons=keyboard, parse_mode='md')


# Called from the plain-text handler while a user has a /setpreferred menu
# open. Returns True if the message was consumed as a list of codes to add.
async def try_consume_typed_codes(event):
    interaction_id = pending_setpref.peek(event.sender_id)
    if interaction_id is None:
        return False

    text = (event.raw_text or '').strip()
    if not CODES_RE.match(text):
        return False

    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'setpref':
        pending_setpref.clear(event.sender_id)
        return False

    payload = interaction['payload']
    # Only listen in the chat the menu was opened in — a bare "USD" typed
    # elsewhere (e.g. a group) shouldn't be silently hoovered up.
    if payload.get('chat_id') != event.chat_id:
        return False

    await currency.ensure_currency_list()

    added, already, unknown = [], [], []
    seen = set()
    for token in re.split(r'[\s,]+', text):
        c = token.lower()
        if c in seen:
            continue
        seen.add(c)
        if not db.currency_exists(c):
            unknown.append(c)
        elif db.has_preference(event.sender_id, c):
            already.append(c)
        else:
            db.add_preference(event.sender_id, c)
            added.append(c)

    lines = []
    if added:
        lines.append('Added ' + ', '.join(code(c.upper()) for c in added) + '.')
    if already:
        lines.append(', '.join(code(c.upper()) for c in already) + ' already in your list.')
    if unknown:
        lines.append("I don't recognise " + ', '.join(code(c.upper()) for c in unknown) + '.')
    lines.append('Type more codes to add them, or tap ✅ Done on the menu when finished.')

    if added:
        currencies = await currency.list_currencies()
        preferred = set(db.get_preferences(event.sender_id))
        keyboard = set_preferred_keyboard(
            interaction_id, payload.get('page', 0), currencies, preferred, payload.get('show_preferred', False)
        )
        await safe_edit_message(
            event.client, payload['chat_id'], payload['message_id'], INTRO, buttons=keyboard, parse_mode='md'
        )

    await event.respond('\n'.join(lines), parse_mode='md')
    return True
