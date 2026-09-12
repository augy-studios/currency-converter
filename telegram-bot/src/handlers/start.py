from .. import db
from ..keyboards import main_menu_keyboard
from ..reply import send_rich_message

MARKDOWN = """# Currency Converter

Convert currencies instantly, right here in Telegram.

## How to use

- Send an amount and a currency code, e.g. **12 USD**, and get it converted into all your preferred currencies.
- /setpreferred - choose which currencies you want to see results in (you can pick more than one).
- /removepreferred - remove currencies from your preferred list.
- /rate - check the current exchange rate for your preferred currencies against any base currency.
- You can also use this bot inline in any chat: type its @username followed by an amount and currency, e.g. **12 USD**.

Rates are sourced live and cached briefly to stay fast."""

FALLBACK = """Currency Converter

Convert currencies instantly, right here in Telegram.

How to use
• Send an amount and a currency code, e.g. 12 USD, and get it converted into all your preferred currencies.
• /setpreferred - choose which currencies you want to see results in (you can pick more than one).
• /removepreferred - remove currencies from your preferred list.
• /rate - check the current exchange rate for your preferred currencies against any base currency.
• You can also use this bot inline in any chat: type its @username followed by an amount and currency, e.g. 12 USD.

Rates are sourced live and cached briefly to stay fast."""


def build_start_view():
    return {'markdown': MARKDOWN, 'fallback': FALLBACK}, main_menu_keyboard()


async def start_handler(event):
    db.ensure_user(event.sender_id)
    rich, buttons = build_start_view()
    await send_rich_message(event.client, event.chat_id, rich, buttons)
