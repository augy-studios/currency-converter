from .. import db, pending_rate
from ..format import escape_md
from ..reply import send_rich_message

PROMPT = 'Send me the base currency you would like to compare against (e.g. USD).'


def build_rate_view(preferred):
    codes = [c.upper() for c in preferred]
    rich = {
        'markdown': (
            '# Your preferred currencies\n\n'
            + '\n'.join(f'- {escape_md(c)}' for c in codes)
            + f'\n\n{PROMPT}'
        ),
        'fallback': f"Your preferred currencies:\n{', '.join(codes)}\n\n{PROMPT}",
    }
    return rich, None


async def rate_handler(event):
    db.ensure_user(event.sender_id)
    preferred = db.get_preferences(event.sender_id)

    if not preferred:
        return await event.respond(
            'You have not picked any preferred currencies yet. Use /setpreferred first.',
            parse_mode='md',
        )

    pending_rate.mark(event.sender_id)
    rich, buttons = build_rate_view(preferred)
    await send_rich_message(event.client, event.chat_id, rich, buttons)
