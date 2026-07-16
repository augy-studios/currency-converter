# Setup guide

This covers getting Telegram API credentials, registering the bot with
BotFather, and running it on a Debian 13 VPS inside `tmux`.

## 1. Get API_ID and API_HASH

Telethon is a full MTProto client library (not a thin Bot API wrapper), so
even when running as a bot it needs an *application* identity, separate
from the bot token you'll get in step 2.

1. Go to <https://my.telegram.org> and log in with your personal Telegram
   account (the one tied to your phone number — this is your identity as
   the app developer, not the bot's identity).
2. Open **API Development Tools**.
3. Fill in an app name and short name (anything, e.g. `Currency Bot` /
   `currencybot`), platform can be "Server". Submit.
4. You'll get an **App api_id** (a number) and **App api_hash** (a hex
   string). Save both — you'll put them in `.env` as `API_ID` and
   `API_HASH`.

## 2. Create the bot with BotFather

1. Open a chat with [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot`.
3. Give it a display name when prompted (this can be anything, e.g.
   `Currency Converter`).
4. Give it a username when prompted. It must end in `bot`, e.g.
   `uwucurrency_bot`.
5. BotFather replies with an API token that looks like
   `123456789:AAExampleTokenDoNotShareThis`. Copy it — you'll put it in
   `.env` as `BOT_TOKEN`. Treat it like a password; anyone with it can
   control the bot.

## 3. Configure the bot's profile

Still talking to BotFather:

- `/setdescription` → pick your bot → send the long description shown
  when someone opens the bot for the first time (before pressing Start),
  e.g.:

  ```text
  Convert currencies instantly in Telegram. Set your preferred currencies once, then send an amount like "12 USD" to convert it into all of them at once. Works inline in any chat too.
  ```

- `/setabouttext` → pick your bot → send the short "About" text shown on
  the bot's profile page, e.g.:

  ```text
  Fast currency conversion, right in Telegram. Send an amount and currency code to get started.
  ```
- `/setuserpic` → pick your bot → upload a square image if you want a
  profile photo.

## 4. Register the commands

`/setcommands` → pick your bot → paste:

```text
start - About the bot and quick links
setpreferred - Choose which currencies you want conversions in
rate - Check the current rate for your preferred currencies
```

These are the exact strings Telegram shows in the `/` command menu, so
keep them lowercase and free of the bot's own name.

## 5. Enable inline mode

`/setinline` → pick your bot → send a placeholder text shown in the
message box before the user types anything, e.g.:

```text
Type an amount and currency, e.g. 12 USD
```

This turns on inline mode; no separate toggle is needed.

## 6. Group chat behaviour (optional)

By default, Telegram's "privacy mode" means a bot added to a group only
sees messages that are commands, replies to it, or mention it — it will
**not** see a plain `12 USD` message in a group. If you want the bot to
respond to plain amount messages inside group chats, disable privacy mode:

`/setprivacy` → pick your bot → `Disable`

This is optional and only matters for group chats; it has no effect on
direct messages or inline mode.

## 7. Deploying on a Debian 13 VPS with tmux

### Install Python

Debian 13 ships a recent Python 3 by default. Confirm you have 3.9+ and
`venv`/`pip`:

```bash
python3 --version
sudo apt-get update
sudo apt-get install -y python3-venv python3-pip
```

### Get the code

```bash
git clone <your-repo-url>
cd currency-converter/telegram-bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configure credentials

```bash
cp .env.example .env
nano .env    # set API_ID, API_HASH (step 1) and BOT_TOKEN (step 2)
```

### Run it in tmux

```bash
tmux new -s currency-bot
source .venv/bin/activate   # if not already active in this shell
python bot.py
```

The first run will ask you to confirm the bot login is proceeding (this is
normal for Telethon and only happens once — it saves a
`bot_session.session` file so subsequent starts don't need this step).
Once you see `Bot started.` in the output, detach without stopping it:

- Press `Ctrl+b`, then `d`.

The bot keeps running in the background. To check on it later:

```bash
tmux attach -t currency-bot
```

To stop it, reattach and press `Ctrl+c`, or run:

```bash
tmux send-keys -t currency-bot C-c
```

### Updating after a git pull

```bash
tmux attach -t currency-bot
# Ctrl+c to stop the running process
git pull
source .venv/bin/activate
pip install -r requirements.txt   # only needed if dependencies changed
python bot.py
# Ctrl+b, d to detach again
```

### Notes

- `data/bot.db` holds all persistent state (preferred currencies, cached
  rates, button data) and is created automatically on first run. It is
  gitignored — back it up separately if you care about preserving user
  preferences across VPS migrations.
- `bot_session.session` holds Telethon's login session for the bot
  account. It's also gitignored — treat it like a secret. If you ever
  need to force a fresh login, stop the bot and delete this file.
- The bot only needs outbound HTTPS access to `currency.uwuapps.org` and
  Telegram's API servers; no inbound ports need to be opened.
