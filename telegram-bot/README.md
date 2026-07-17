# UwU Currency Converter — Telegram Bot

A Telegram bot for converting currencies, backed by the same self-hosted
[Frankfurter](https://frankfurter.dev) instance that powers the
[UwU Currency Converter](https://currency.uwuapps.org/) web app, called
directly at `https://api.currency.uwuapps.org` (not through the web app's
own API routes).

Built with [Telethon](https://docs.telethon.dev/) (Python).

## What it does

- Pick a list of "preferred" currencies once, then convert into all of them
  at once just by sending a message like `12 USD`.
- Works inline too — type the bot's username followed by an amount and
  currency in any chat to get a quick conversion, no need to open a DM.
- Every result comes with a **Refresh** button to re-pull the live rate, and
  (in direct chats) a **Copy** button per currency so you can paste the raw
  number elsewhere.
- A **📈 Graph** button under conversion results renders a historical-rate
  chart as an image, comparing your preferred currencies against the base
  currency. Tap a range (5D/1W/1M/1Y/5Y/Max) or add/remove a currency to
  compare, and the same image is edited in place rather than a new one
  being sent.
- All state — your preferred currencies and the button data behind
  Refresh/Graph — lives in a local SQLite database, so it survives bot
  restarts.

## Using the bot

### Commands

| Command | What it does |
| --- | --- |
| `/start` | Shows what the bot does, with links to the web app and a donation page. |
| `/setpreferred` | Opens a paginated list of currencies. Tap one to add/remove it from your preferred list — you can pick as many as you like. Tap **⭐ Show Preferred** to switch the same list to just your picks (tapping one there removes it, an alternate way to unpick without leaving the menu), and **✅ Done** to lock in your picks and clear the buttons. |
| `/removepreferred` | Opens a paginated list of only your currently preferred currencies. Tap one to remove it, or **✅ Done** when finished. |
| `/rate` | Lists your preferred currencies, then waits for you to send a base currency (e.g. `USD`) to compare them against. |

### Converting a value

Once you have at least one preferred currency set via `/setpreferred`, just
send a message in the format:

```text
12 USD
```

The bot replies with `12 USD` converted into every currency you picked,
each with its own **Copy** button, plus a **Refresh** button at the top of
the list to re-check the rate, and a **📈 Graph** button.

### Viewing a graph

Tap **📈 Graph** under a conversion result to get a historical-rate chart
(base currency vs. your preferred currencies, up to 5), sent as an image.
From there:

- Tap a range button (**5D / 1W / 1M / 1Y / 5Y / Max**) to redraw the same
  image over that period.
- Tap **➕ Add currency**, then reply with a currency code (e.g. `EUR`) to
  add it to the comparison.
- Tap **➖ Remove currency** to pick one to drop (at least one must remain).

Comparing 2+ currencies indexes every line to 100 at the start of the
visible range, since raw rates can sit on very different scales (e.g. JPY
vs. MYR) and would otherwise flatten the smaller one to invisibility on a
shared axis.

### Inline mode

In any chat, type:

```text
@<bot_username> 12 USD
```

and pick the result. Inline results get **Refresh** and **📈 Graph**
buttons, but no per-row Copy buttons (since inline messages are sent into
someone else's chat). Since the bot has no access to that chat, tapping
**Graph** on an inline result sends the chart to your DM with the bot
instead of the chat you're in — you'll need to have messaged the bot
directly at least once first.

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
  git). Holds users, preferred currencies, the cached currency list (with
  each currency's symbol and date-availability range), a short-lived rate
  cache, and the interaction records behind inline buttons.
- The full currency list is refreshed from the API at most once every 24
  hours.
- Exchange rates are cached for 60 seconds per base currency to avoid
  hammering the API when several people convert around the same time.
  Tapping **Refresh** always bypasses this cache and fetches live.
  Historical data for graphs is always fetched live (not cached), since
  it's requested on demand rather than repeatedly.
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
  currency.py                currency list + rate/history caching on top of api.py
  convert.py                 shared conversion logic and message formatting
  graph.py                   matplotlib rendering of the historical-rate chart
  format.py                  Markdown code-span and number formatting helpers
  keyboards.py               inline keyboard builders
  pending_rate.py            in-memory "awaiting base currency" state for /rate
  pending_graph_add.py       in-memory "awaiting currency to add" state for graphs
  handlers/
    start.py
    setpreferred.py
    removepreferred.py
    rate.py
    message.py               parses "<amount> <code>" and bare-code replies
    callbacks.py              routes button taps (refresh, remove, open graph)
    graph.py                  graph rendering flow: range/add/remove callbacks
    inline.py                 inline query handler
```

## Why Telethon

Telethon is a full MTProto client library rather than a thin Bot API
wrapper, so it needs `API_ID`/`API_HASH` (an application identity from
Telegram, separate from the bot token) in addition to the usual
`BOT_TOKEN`. In exchange it gives native support for everything this bot
needs: inline queries, callback queries, and the `copy_text` clipboard
button used for the per-currency Copy buttons.
