const crypto = require('crypto');
const db = require('../db');
const currency = require('../currency');
const { computeConversion, buildConversionMessage } = require('../convert');
const { convertKeyboard } = require('../keyboards');

const AMOUNT_CODE_RE = /^(-?\d+(?:\.\d+)?)\s+([A-Za-z]{2,10})$/;

async function inlineQueryHandler(ctx) {
  const query = (ctx.inlineQuery.query || '').trim();
  const userId = ctx.inlineQuery.from.id;
  db.ensureUser(userId);

  const match = query.match(AMOUNT_CODE_RE);
  if (!match) {
    return ctx.answerInlineQuery(
      [
        {
          type: 'article',
          id: 'help',
          title: 'Type an amount and currency code',
          description: 'Example: 12 USD',
          input_message_content: {
            message_text: 'Type an amount and a currency code to convert, for example: 12 USD',
          },
        },
      ],
      { cache_time: 0 }
    );
  }

  const amount = parseFloat(match[1]);
  const code = match[2].toLowerCase();

  const valid = await currency.isValidCurrency(code);
  if (!valid) {
    return ctx.answerInlineQuery(
      [
        {
          type: 'article',
          id: 'invalid',
          title: `Unknown currency: ${match[2].toUpperCase()}`,
          description: 'Check the currency code and try again',
          input_message_content: {
            message_text: `Unknown currency code: ${match[2].toUpperCase()}`,
          },
        },
      ],
      { cache_time: 0 }
    );
  }

  const preferred = db.getPreferences(userId);
  if (preferred.length === 0) {
    return ctx.answerInlineQuery(
      [
        {
          type: 'article',
          id: 'noprefs',
          title: 'No preferred currencies set',
          description: 'Message the bot directly and use /setpreferred first',
          input_message_content: {
            message_text: 'You have not picked any preferred currencies yet. Message this bot directly and use /setpreferred first.',
          },
        },
      ],
      { cache_time: 0 }
    );
  }

  const conversion = await computeConversion(userId, amount, code);
  const text = buildConversionMessage(conversion);
  const interactionId = db.createInteraction('convert', userId, { amount, base: code });
  const keyboard = convertKeyboard(interactionId, conversion.results, false);

  return ctx.answerInlineQuery(
    [
      {
        type: 'article',
        id: crypto.randomUUID(),
        title: `${match[1]} ${match[2].toUpperCase()} converted`,
        description: conversion.results.map((r) => `${r.code.toUpperCase()}: ${r.formatted}`).join(', '),
        input_message_content: {
          message_text: text,
          parse_mode: 'MarkdownV2',
        },
        reply_markup: keyboard.reply_markup,
      },
    ],
    { cache_time: 0 }
  );
}

module.exports = inlineQueryHandler;
