from telethon.tl import types

from .. import db
from ..convert import build_conversion_message, compute_conversion
from ..edit_utils import safe_edit
from ..keyboards import convert_keyboard


async def setpref_callback(event):
    from .setpreferred import callback as setpref_cb

    parts = event.data.decode().split(':')
    await setpref_cb(event, parts)


async def removepref_callback(event):
    from .removepreferred import callback as removepref_cb

    parts = event.data.decode().split(':')
    await removepref_cb(event, parts)


async def convert_refresh_callback(event):
    parts = event.data.decode().split(':')
    interaction_id = int(parts[1])
    interaction = db.get_interaction(interaction_id)

    if not interaction or interaction['kind'] != 'convert':
        return await event.answer('This result has expired.', alert=True)

    # Refresh always reflects the requesting user's current preferences,
    # not a frozen snapshot, and re-fetches live rates (bypassing the cache).
    amount, base = interaction['payload']['amount'], interaction['payload']['base']
    conversion = await compute_conversion(interaction['user_id'], amount, base, force=True)
    if not conversion:
        return await event.answer('No preferred currencies set anymore.', alert=True)

    text = build_conversion_message(conversion)
    is_inline = isinstance(
        event.query.msg_id, (types.InputBotInlineMessageID, types.InputBotInlineMessageID64)
    )
    keyboard = convert_keyboard(interaction_id, conversion['results'], not is_inline)

    await event.answer('Refreshed')
    await safe_edit(event, text, buttons=keyboard, parse_mode='md', link_preview=False)
