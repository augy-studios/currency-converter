const currency = require('./currency');
const db = require('./db');
const { code, formatNumber } = require('./format');
const { convertKeyboard } = require('./keyboards');

// Computes conversion of `amount` in `baseCode` into every one of the
// user's preferred currencies. Returns null if the user has no preferences.
async function computeConversion(userId, amount, baseCode, { force = false } = {}) {
  const preferred = db.getPreferences(userId);
  if (preferred.length === 0) return null;

  const base = baseCode.toLowerCase();
  const { date, rates } = await currency.getRates(base, { force });

  const results = [];
  for (const targetCode of preferred) {
    let rate;
    if (targetCode === base) {
      rate = 1;
    } else if (rates[targetCode] !== undefined) {
      rate = rates[targetCode];
    } else {
      continue; // currency not present for this base (e.g. delisted), skip quietly
    }
    const value = amount * rate;
    results.push({ code: targetCode, value, formatted: formatNumber(value) });
  }

  return { date, base, amount, results };
}

function buildConversionMessage(conversion) {
  const { date, base, amount, results } = conversion;
  const amountStr = formatNumber(amount);
  const header = `*Converting* ${code(`${amountStr} ${base.toUpperCase()}`)}`;

  if (results.length === 0) {
    return `${header}\n\nNone of your preferred currencies have rate data for this base right now\\.`;
  }

  const lines = results.map((r) => `*${r.code.toUpperCase()}* — ${code(r.formatted)}`);
  return `${header}\n\n${lines.join('\n')}\n\n_Rates as of ${code(date)}_`;
}

// Sends a fresh conversion result as a new chat message, backed by an
// `interactions` row so the Refresh/Copy buttons keep working after restarts.
async function sendConversion(ctx, userId, amount, baseCode) {
  const conversion = await computeConversion(userId, amount, baseCode);
  if (!conversion) {
    return ctx.replyWithMarkdownV2('You have not picked any preferred currencies yet\\. Use /setpreferred first\\.');
  }

  const interactionId = db.createInteraction('convert', userId, { amount, base: baseCode.toLowerCase() });
  const text = buildConversionMessage(conversion);
  return ctx.replyWithMarkdownV2(text, convertKeyboard(interactionId, conversion.results, true));
}

module.exports = { computeConversion, buildConversionMessage, sendConversion };
