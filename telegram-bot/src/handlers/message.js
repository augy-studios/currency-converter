const db = require('../db');
const currency = require('../currency');
const pendingRate = require('../pendingRate');
const { sendConversion } = require('../convert');
const { code } = require('../format');

const AMOUNT_CODE_RE = /^(-?\d+(?:\.\d+)?)\s+([A-Za-z]{2,10})$/;
const BARE_CODE_RE = /^([A-Za-z]{2,10})$/;

async function messageHandler(ctx) {
  const text = (ctx.message.text || '').trim();
  db.ensureUser(ctx.from.id);

  const amountMatch = text.match(AMOUNT_CODE_RE);
  if (amountMatch) {
    pendingRate.consume(ctx.from.id);
    return handleConvert(ctx, parseFloat(amountMatch[1]), amountMatch[2]);
  }

  const bareMatch = text.match(BARE_CODE_RE);
  if (bareMatch && pendingRate.consume(ctx.from.id)) {
    return handleConvert(ctx, 1, bareMatch[1]);
  }

  // Not a recognised format, and not something we're expecting - stay quiet
  // rather than nagging on every unrelated message in a group chat.
}

async function handleConvert(ctx, amount, rawCode) {
  const currencyCode = rawCode.toLowerCase();
  const valid = await currency.isValidCurrency(currencyCode);
  if (!valid) {
    return ctx.replyWithMarkdownV2(`I don't recognise the currency ${code(currencyCode.toUpperCase())}\\. Check the code and try again\\.`);
  }
  await sendConversion(ctx, ctx.from.id, amount, currencyCode);
}

module.exports = messageHandler;
