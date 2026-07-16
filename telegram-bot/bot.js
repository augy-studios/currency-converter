require('dotenv').config();
const { Telegraf } = require('telegraf');

const db = require('./src/db');
const startHandler = require('./src/handlers/start');
const setpreferred = require('./src/handlers/setpreferred');
const rateHandler = require('./src/handlers/rate');
const messageHandler = require('./src/handlers/message');
const callbackQueryHandler = require('./src/handlers/callbacks');
const inlineQueryHandler = require('./src/handlers/inline');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Missing BOT_TOKEN. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Telegraf(token);

bot.command('start', startHandler);
bot.command('setpreferred', setpreferred.command);
bot.command('rate', rateHandler);

bot.on('text', messageHandler);
bot.on('callback_query', callbackQueryHandler);
bot.on('inline_query', inlineQueryHandler);

bot.catch((err, ctx) => {
  console.error(`Error while handling update ${ctx.updateType}:`, err);
});

db.pruneOldInteractions();

bot.launch().then(() => {
  console.log('Bot started.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
