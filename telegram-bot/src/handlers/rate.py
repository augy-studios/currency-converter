from .. import db, pending_rate
from ..format import code


async def rate_handler(event):
    db.ensure_user(event.sender_id)
    preferred = db.get_preferences(event.sender_id)

    if not preferred:
        return await event.respond('You have not picked any preferred currencies yet. Use /setpreferred first.')

    pending_rate.mark(event.sender_id)
    listing = ', '.join(code(c.upper()) for c in preferred)
    await event.respond(
        f'**Your preferred currencies:**\n{listing}\n\n'
        f"Send me the base currency you would like to compare against (e.g. {code('USD')}).",
        parse_mode='md',
    )
