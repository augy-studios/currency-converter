# UwU Currency Converter — Telegram Bot

A Telegram bot for converting currencies, built on top of the same API that
powers the [UwU Currency Converter](https://currency.uwuapps.org/) web app
(`https://currency.uwuapps.org/api/currencies` and
`https://currency.uwuapps.org/api/rates`).

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
| `/rate` | Lists your preferred currencies, then waits for you to send a base currency (e.g. `USD`) to compare them against. |

### Converting a value

Once you have at least one preferred currency set via `/setpreferred`, just
send a message in the format:

```
12 USD
```

The bot replies with `12 USD` converted into every currency you picked,
each with its own **Copy** button, plus a **Refresh** button at the top of
the list to re-check the rate.

### Inline mode

In any chat, type:

```
@<bot_username> 12 USD
```

and pick the result. Inline results only get a **Refresh** button (no
per-row Copy buttons, since inline messages are sent into someone else's
chat).

## Running it

```bash
npm install
cp .env.example .env   # then fill in BOT_TOKEN
npm start
```

See [setup.md](./setup.md) for registering the bot with BotFather (token,
commands, inline mode, description) and running it persistently in `tmux`
on a Debian VPS.

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

## Project layout

```
bot.js                   entry point
src/
  db.js                  SQLite schema and query helpers
  api.js                 raw HTTP calls to the currency API
  currency.js            currency list + rate caching on top of api.js
  convert.js             shared conversion logic and message formatting
  format.js              MarkdownV2 escaping and number formatting helpers
  keyboards.js           inline keyboard builders
  pendingRate.js         in-memory "awaiting base currency" state for /rate
  handlers/
    start.js
    setpreferred.js
    rate.js
    message.js           parses "<amount> <code>" and bare-code replies
    callbacks.js          routes button taps (setpreferred + refresh)
    inline.js             inline query handler
```
