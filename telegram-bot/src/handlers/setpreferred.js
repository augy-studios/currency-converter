const db = require('../db');
const currency = require('../currency');
const { setPreferredKeyboard } = require('../keyboards');

const INTRO =
  'Pick the currencies you would like to see \\(you can select more than one — tap to toggle\\)\\.';

async function render(ctx, interactionId, page) {
  const [currencies, preferred] = await Promise.all([
    currency.listCurrencies(),
    Promise.resolve(db.getPreferences(ctx.from.id)),
  ]);
  const selected = new Set(preferred);
  const keyboard = setPreferredKeyboard(interactionId, page, currencies, selected);
  return keyboard;
}

async function command(ctx) {
  db.ensureUser(ctx.from.id);
  const interactionId = db.createInteraction('setpref', ctx.from.id, { page: 0 });
  const keyboard = await render(ctx, interactionId, 0);
  await ctx.replyWithMarkdownV2(INTRO, keyboard);
}

async function callback(ctx, parts) {
  const [, idStr, action, arg] = parts;
  const id = Number(idStr);
  const interaction = db.getInteraction(id);

  if (!interaction || interaction.kind !== 'setpref') {
    return ctx.answerCbQuery('This menu has expired. Run /setpreferred again.', { show_alert: true });
  }
  if (interaction.user_id !== ctx.from.id) {
    return ctx.answerCbQuery('This menu belongs to someone else.', { show_alert: true });
  }

  let page = interaction.payload.page || 0;

  if (action === 'noop') {
    return ctx.answerCbQuery();
  }

  if (action === 'page') {
    page = Number(arg);
    db.updateInteraction(id, { page });
  } else if (action === 'toggle') {
    const nowSelected = db.togglePreference(ctx.from.id, arg);
    await ctx.answerCbQuery(nowSelected ? `Added ${arg.toUpperCase()}` : `Removed ${arg.toUpperCase()}`);
  } else if (action === 'clear') {
    db.clearPreferences(ctx.from.id);
    page = Number(arg) || 0;
    await ctx.answerCbQuery('Cleared all preferred currencies.');
  }

  const keyboard = await render(ctx, id, page);
  try {
    await ctx.editMessageReplyMarkup(keyboard.reply_markup);
  } catch (err) {
    // Ignore "message is not modified" when toggling produces an identical keyboard
    if (!String(err.description || err.message).includes('not modified')) throw err;
  }
  if (action !== 'toggle' && action !== 'clear') {
    await ctx.answerCbQuery();
  }
}

module.exports = { command, callback };
