# UwU Currency Converter — Telegram Bot

A Telegram bot for converting currencies, built on top of the same API that
powers the [UwU Currency Converter](https://currency.uwuapps.org/) web app
(`https://currency.uwuapps.org/api/currencies` and
`https://currency.uwuapps.org/api/rates`).

Built with [Telethon](https://docs.telethon.dev/) (Python).

## What it does

- Pick a list of "preferred" currencies once, then convert into all of them
  at once just by sending a message like `12 USD`.
- Works inline too — type the bot's username followed by an amount and
  currency in any chat to get a quick conversion, no need to open a DM.
- Every result comes with a **Refresh** button to re-pull the live rate, and
  (in direct chats) a **Copy** button per currency so you can paste the raw
  number elsewhere.
- All state — your preferred currencies and the button data behind Refresh —
  lives in a local SQLite database, so it survives bot restarts.

## Using the bot

### Commands

| Command | What it does |
| --- | --- |
| `/start` | Shows what the bot does, with links to the web app and a donation page. |
| `/setpreferred` | Opens a paginated list of currencies. Tap one to add/remove it from your preferred list — you can pick as many as you like. Includes a "Clear All" button. |
| `/removepreferred` | Opens a paginated list of only your currently preferred currencies. Tap one to remove it. |
| `/rate` | Lists your preferred currencies, then waits for you to send a base currency (e.g. `USD`) to compare them against. |

### Converting a value

Once you have at least one preferred currency set via `/setpreferred`, just
send a message in the format:

```text
12 USD
```

The bot replies with `12 USD` converted into every currency you picked,
each with its own **Copy** button, plus a **Refresh** button at the top of
the list to re-check the rate.

### Inline mode

In any chat, type:

```text
@<bot_username> 12 USD
```

and pick the result. Inline results only get a **Refresh** button (no
per-row Copy buttons, since inline messages are sent into someone else's
chat).

## Running it

```bash
python3 -m venv .venv
source .venv/bin/activate    # on Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # then fill in API_ID, API_HASH, BOT_TOKEN
python bot.py
```

See [SETUP.md](./SETUP.md) for getting `API_ID`/`API_HASH` from
my.telegram.org, registering the bot with BotFather (token, commands,
inline mode, description), and running it persistently in `tmux` on a
Debian VPS.

## Data and caching

- SQLite database file: `data/bot.db` (created automatically, ignored by
  git). Holds users, preferred currencies, the cached currency list, a
  short-lived rate cache, and the interaction records behind inline
  buttons.
- The full currency list is refreshed from the API at most once every 24
  hours.
- Exchange rates are cached for 60 seconds per base currency to avoid
  hammering the API when several people convert around the same time.
  Tapping **Refresh** always bypasses this cache and fetches live.
- `bot_session.session` (created on first run, also gitignored) holds
  Telethon's login session for the bot account — treat it like a secret,
  same as the bot token.

## Project layout

```text
bot.py                       entry point
requirements.txt
src/
  db.py                      SQLite schema and query helpers
  api.py                     raw async HTTP calls to the currency API
  currency.py                currency list + rate caching on top of api.py
  convert.py                 shared conversion logic and message formatting
  format.py                  Markdown code-span and number formatting helpers
  keyboards.py               inline keyboard builders
  pending_rate.py            in-memory "awaiting base currency" state for /rate
  handlers/
    start.py
    setpreferred.py
    removepreferred.py
    rate.py
    message.py               parses "<amount> <code>" and bare-code replies
    callbacks.py              routes button taps (refresh, remove)
    inline.py                 inline query handler
```

## Why Telethon

Telethon is a full MTProto client library rather than a thin Bot API
wrapper, so it needs `API_ID`/`API_HASH` (an application identity from
Telegram, separate from the bot token) in addition to the usual
`BOT_TOKEN`. In exchange it gives native support for everything this bot
needs: inline queries, callback queries, and the `copy_text` clipboard
button used for the per-currency Copy buttons.
