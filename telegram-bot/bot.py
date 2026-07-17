import asyncio
import os

from dotenv import load_dotenv
from telethon import TelegramClient, events

from src import api, db
from src.handlers import callbacks, graph, inline, message, rate, removepreferred, setpreferred, start

load_dotenv()

API_ID = os.environ.get('API_ID')
API_HASH = os.environ.get('API_HASH')
BOT_TOKEN = os.environ.get('BOT_TOKEN')

if not API_ID or not API_HASH or not BOT_TOKEN:
    raise SystemExit(
        'Missing API_ID, API_HASH, or BOT_TOKEN. Copy .env.example to .env and fill it in '
        '(see SETUP.md for how to get API_ID/API_HASH from my.telegram.org).'
    )

client = TelegramClient('bot_session', int(API_ID), API_HASH)

client.add_event_handler(start.start_handler, events.NewMessage(pattern=r'(?i)^/start(?:@\w+)?$'))
client.add_event_handler(
    setpreferred.command, events.NewMessage(pattern=r'(?i)^/setpreferred(?:@\w+)?$')
)
client.add_event_handler(
    removepreferred.command, events.NewMessage(pattern=r'(?i)^/removepreferred(?:@\w+)?$')
)
client.add_event_handler(rate.rate_handler, events.NewMessage(pattern=r'(?i)^/rate(?:@\w+)?$'))

client.add_event_handler(
    message.message_handler,
    events.NewMessage(func=lambda e: not (e.raw_text or '').startswith('/')),
)

client.add_event_handler(callbacks.setpref_callback, events.CallbackQuery(pattern=rb'^sp:'))
client.add_event_handler(callbacks.removepref_callback, events.CallbackQuery(pattern=rb'^rp:'))
client.add_event_handler(callbacks.convert_refresh_callback, events.CallbackQuery(pattern=rb'^cv:'))
client.add_event_handler(graph.graph_callback, events.CallbackQuery(pattern=rb'^gr:'))

client.add_event_handler(inline.inline_handler, events.InlineQuery())


async def main():
    db.prune_old_interactions()
    await client.start(bot_token=BOT_TOKEN)
    print('Bot started.')
    try:
        await client.run_until_disconnected()
    finally:
        await api.close_session()


if __name__ == '__main__':
    asyncio.run(main())
