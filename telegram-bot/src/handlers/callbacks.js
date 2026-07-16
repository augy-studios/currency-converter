const db = require('../db');
const setpreferred = require('./setpreferred');
const { computeConversion, buildConversionMessage } = require('../convert');
const { convertKeyboard } = require('../keyboards');

async function callbackQueryHandler(ctx) {
  const data = ctx.callbackQuery.data || '';
  const parts = data.split(':');
  const prefix = parts[0];

  if (prefix === 'sp') {
    return setpreferred.callback(ctx, parts);
  }

  if (prefix === 'cv') {
    return handleConvertRefresh(ctx, parts);
  }

  return ctx.answerCbQuery();
}

async function handleConvertRefresh(ctx, parts) {
  const [, idStr] = parts;
  const id = Number(idStr);
  const interaction = db.getInteraction(id);

  if (!interaction || interaction.kind !== 'convert') {
    return ctx.answerCbQuery('This result has expired.', { show_alert: true });
  }

  // Refresh always reflects the requesting user's current preferences,
  // not a frozen snapshot, and re-fetches live rates (bypassing the cache).
  const { amount, base } = interaction.payload;
  const conversion = await computeConversion(interaction.user_id, amount, base, { force: true });
  if (!conversion) {
    return ctx.answerCbQuery('No preferred currencies set anymore.', { show_alert: true });
  }

  const text = buildConversionMessage(conversion);
  const includeCopyButtons = !ctx.callbackQuery.inline_message_id;
  const keyboard = convertKeyboard(id, conversion.results, includeCopyButtons);

  try {
    await ctx.editMessageText(text, { parse_mode: 'MarkdownV2', ...keyboard });
  } catch (err) {
    if (!String(err.description || err.message).includes('not modified')) throw err;
  }
  await ctx.answerCbQuery('Refreshed');
}

module.exports = callbackQueryHandler;
