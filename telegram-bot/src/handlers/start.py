from .. import db
from ..keyboards import main_menu_keyboard

TEXT = """**Currency Converter**

Convert currencies instantly, right here in Telegram.

**How to use**
• Send an amount and a currency code, e.g. `12 USD`, and get it converted into all your preferred currencies.
• /setpreferred - choose which currencies you want to see results in (you can pick more than one).
• /removepreferred - remove currencies from your preferred list.
• /rate - check the current exchange rate for your preferred currencies against any base currency.
• You can also use this bot inline in any chat: type its @username followed by an amount and currency, e.g. `12 USD`.

Rates are sourced live and cached briefly to stay fast."""


async def start_handler(event):
    db.ensure_user(event.sender_id)
    await event.respond(TEXT, buttons=main_menu_keyboard(), parse_mode='md', link_preview=False)
