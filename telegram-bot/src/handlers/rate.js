const db = require('../db');
const pendingRate = require('../pendingRate');
const { code } = require('../format');

async function rateHandler(ctx) {
  db.ensureUser(ctx.from.id);
  const preferred = db.getPreferences(ctx.from.id);

  if (preferred.length === 0) {
    return ctx.replyWithMarkdownV2('You have not picked any preferred currencies yet\\. Use /setpreferred first\\.');
  }

  pendingRate.mark(ctx.from.id);
  const list = preferred.map((c) => code(c.toUpperCase())).join(', ');
  await ctx.replyWithMarkdownV2(
    `*Your preferred currencies:*\n${list}\n\nSend me the base currency you would like to compare against \\(e\\.g\\. ${code(
      'USD'
    )}\\)\\.`
  );
}

module.exports = rateHandler;
