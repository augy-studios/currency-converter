# Setup guide

This covers registering the bot with BotFather from scratch, then running
it on a Debian 13 VPS inside `tmux`.

## 1. Create the bot with BotFather

1. Open a chat with [@BotFather](https://t.me/BotFather) on Telegram.
2. Send `/newbot`.
3. Give it a display name when prompted (this can be anything, e.g.
   `Currency Converter`).
4. Give it a username when prompted. It must end in `bot`, e.g.
   `uwucurrency_bot`.
5. BotFather replies with an API token that looks like
   `123456789:AAExampleTokenDoNotShareThis`. Copy it — you'll put it in
   `.env` as `BOT_TOKEN` later. Treat it like a password; anyone with it
   can control the bot.

## 2. Configure the bot's profile

Still talking to BotFather:

- `/setdescription` → pick your bot → send the long description shown
  when someone opens the bot for the first time (before pressing Start),
  e.g.:
  ```
  Convert currencies instantly in Telegram. Set your preferred currencies once, then send an amount like "12 USD" to convert it into all of them at once. Works inline in any chat too.
  ```
- `/setabouttext` → pick your bot → send the short "About" text shown on
  the bot's profile page, e.g.:
  ```
  Fast currency conversion, right in Telegram. Send an amount and currency code to get started.
  ```
- `/setuserpic` → pick your bot → upload a square image if you want a
  profile photo.

## 3. Register the commands

`/setcommands` → pick your bot → paste:

```
start - About the bot and quick links
setpreferred - Choose which currencies you want conversions in
rate - Check the current rate for your preferred currencies
```

These are the exact strings Telegram shows in the `/` command menu, so
keep them lowercase and free of the bot's own name.

## 4. Enable inline mode

`/setinline` → pick your bot → send a placeholder text shown in the
message box before the user types anything, e.g.:

```
Type an amount and currency, e.g. 12 USD
```

This turns on inline mode; no separate toggle is needed.

## 5. Group chat behaviour (optional)

By default, Telegram's "privacy mode" means a bot added to a group only
sees messages that are commands, replies to it, or mention it — it will
**not** see a plain `12 USD` message in a group. If you want the bot to
respond to plain amount messages inside group chats, disable privacy mode:

`/setprivacy` → pick your bot → `Disable`

This is optional and only matters for group chats; it has no effect on
direct messages or inline mode.

## 6. Deploying on a Debian 13 VPS with tmux

### Install Node.js

Debian 13's default `apt` Node package is often outdated. Use NodeSource to
get a current LTS release (Node 18 or newer is required):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3
```

`build-essential` and `python3` are only needed as a fallback in case
`better-sqlite3` has no prebuilt binary for your exact platform/Node
version — npm will compile it from source automatically if so.

### Get the code

```bash
git clone <your-repo-url>
cd currency-converter/telegram-bot
npm install
```

### Configure the token

```bash
cp .env.example .env
nano .env    # set BOT_TOKEN=the token from step 1
```

### Run it in tmux

```bash
tmux new -s currency-bot
npm start
```

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
npm install   # only needed if dependencies changed
npm start
# Ctrl+b, d to detach again
```

### Notes

- `data/bot.db` holds all persistent state (preferred currencies, cached
  rates, button data) and is created automatically on first run. It is
  gitignored — back it up separately if you care about preserving user
  preferences across VPS migrations.
- The bot only needs outbound HTTPS access to `currency.uwuapps.org` and
  Telegram's API servers; no inbound ports need to be opened.
