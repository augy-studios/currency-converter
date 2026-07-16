const db = require('../db');
const { mainMenuKeyboard } = require('../keyboards');

const TEXT = `*Currency Converter*

Convert currencies instantly, right here in Telegram\\.

*How to use*
• Send an amount and a currency code, e\\.g\\. \`12 USD\`, and get it converted into all your preferred currencies\\.
• /setpreferred — choose which currencies you want to see results in \\(you can pick more than one\\)\\.
• /rate — check the current exchange rate for your preferred currencies against any base currency\\.
• You can also use this bot inline in any chat: type its @username followed by an amount and currency, e\\.g\\. \`12 USD\`\\.

Rates are sourced live and cached briefly to stay fast\\.`;

async function startHandler(ctx) {
  db.ensureUser(ctx.from.id);
  await ctx.replyWithMarkdownV2(TEXT, mainMenuKeyboard());
}

module.exports = startHandler;
