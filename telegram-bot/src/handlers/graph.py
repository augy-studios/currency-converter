from telethon.tl import types

from .. import currency, db, pending_graph_add
from ..edit_utils import safe_edit, safe_edit_message
from ..graph import render_graph
from ..keyboards import graph_keyboard, graph_remove_keyboard

MAX_QUOTES = 5


async def _build_series(base, quotes, range_key):
    rows = await currency.get_history(base, quotes, range_key)
    buckets = {q: {} for q in quotes}
    for row in rows:
        q = row['quote'].lower()
        if q in buckets:
            buckets[q][row['date']] = row['rate']
    return {q: sorted(buckets[q].items()) for q in quotes}


async def _render(payload):
    series = await _build_series(payload['base'], payload['quotes'], payload['range'])
    return render_graph(payload['base'], series)


# Entry point from the "📈 Graph" button under a conversion result. Seeds the
# graph with that conversion's base currency and its preferred currencies
# (excluding the base itself) as the initial comparison set.
async def open_graph(event, conv_interaction_id):
    conv = db.get_interaction(conv_interaction_id)
    if not conv or conv['kind'] != 'convert':
        return await event.answer('This result has expired.', alert=True)

    base = conv['payload']['base']
    preferred = [c for c in db.get_preferences(conv['user_id']) if c != base]
    if not preferred:
        return await event.answer(
            'Add another preferred currency (besides the base) to compare it on a graph.', alert=True
        )

    quotes = preferred[:MAX_QUOTES]
    payload = {'base': base, 'quotes': quotes, 'range': '1m'}
    interaction_id = db.create_interaction('graph', conv['user_id'], payload)

    buf = await _render(payload)

    # Inline results are posted into chats the bot has no access to (it isn't
    # a member), so a new photo message can't be sent there — DM it to the
    # user instead. This requires the user to have messaged the bot before.
    is_inline = isinstance(
        event.query.msg_id, (types.InputBotInlineMessageID, types.InputBotInlineMessageID64)
    )
    if is_inline:
        try:
            message = await event.client.send_file(
                conv['user_id'], file=buf, buttons=graph_keyboard(interaction_id, '1m')
            )
        except Exception:
            return await event.answer(
                'Message the bot directly first (e.g. /start), then try the graph again.', alert=True
            )
        await event.answer('Graph sent in your DM with the bot')
    else:
        await event.answer()
        message = await event.respond(file=buf, buttons=graph_keyboard(interaction_id, '1m'))

    payload['chat_id'] = message.chat_id
    payload['message_id'] = message.id
    db.update_interaction(interaction_id, payload)


async def graph_callback(event):
    parts = event.data.decode().split(':')
    interaction_id = int(parts[1])
    action = parts[2]
    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'graph':
        return await event.answer('This graph has expired.', alert=True)

    payload = interaction['payload']

    if action == 'range':
        payload['range'] = parts[3]
        db.update_interaction(interaction_id, payload)
        buf = await _render(payload)
        await event.answer()
        await safe_edit(event, file=buf, buttons=graph_keyboard(interaction_id, payload['range']))
        return

    if action == 'add':
        pending_graph_add.mark(interaction['user_id'], interaction_id)
        await event.answer('Send me a currency code to add (e.g. USD).', alert=True)
        return

    if action == 'remove':
        await event.answer()
        await safe_edit(event, buttons=graph_remove_keyboard(interaction_id, payload['quotes']))
        return

    if action == 'doremove':
        target = parts[3]
        if len(payload['quotes']) <= 1:
            return await event.answer('Keep at least one currency.', alert=True)
        payload['quotes'] = [q for q in payload['quotes'] if q != target]
        db.update_interaction(interaction_id, payload)
        buf = await _render(payload)
        await event.answer('Removed')
        await safe_edit(event, file=buf, buttons=graph_keyboard(interaction_id, payload['range']))
        return

    if action == 'back':
        await event.answer()
        await safe_edit(event, buttons=graph_keyboard(interaction_id, payload['range']))
        return


# Called from the plain-text handler when a user is mid "Add currency" flow.
# Returns True if the message was consumed as a currency-add reply.
async def try_consume_pending_add(event):
    interaction_id = pending_graph_add.consume(event.sender_id)
    if interaction_id is None:
        return False

    text = (event.raw_text or '').strip().lower()
    interaction = db.get_interaction(interaction_id)
    if not interaction or interaction['kind'] != 'graph':
        return True  # expired; swallow the reply rather than falling through to conversion parsing

    if not await currency.is_valid_currency(text):
        await event.respond(f"I don't recognise the currency {text.upper()}. Try again or tap Add currency again.")
        return True

    payload = interaction['payload']
    if text == payload['base'] or text in payload['quotes']:
        await event.respond(f'{text.upper()} is already on this graph.')
        return True
    if len(payload['quotes']) >= MAX_QUOTES:
        await event.respond(f'Up to {MAX_QUOTES} currencies at once — remove one first.')
        return True

    payload['quotes'].append(text)
    db.update_interaction(interaction_id, payload)
    buf = await _render(payload)
    chat_id, message_id = payload.get('chat_id'), payload.get('message_id')
    if chat_id and message_id:
        await safe_edit_message(
            event.client, chat_id, message_id, file=buf, buttons=graph_keyboard(interaction_id, payload['range'])
        )
    await event.respond(f'Added {text.upper()} to the graph.')
    return True
