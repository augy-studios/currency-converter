const { Markup } = require('telegraf');

const PAGE_SIZE = 8;

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url('Open Web App', 'https://currency.uwuapps.org/')],
    [Markup.button.url('Donate', 'https://donate.stripe.com/28o2akeAr3hv0DK6oo')],
  ]);
}

function setPreferredKeyboard(interactionId, page, currencies, selected) {
  const totalPages = Math.max(1, Math.ceil(currencies.length / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = clampedPage * PAGE_SIZE;
  const pageItems = currencies.slice(start, start + PAGE_SIZE);

  const rows = pageItems.map((c) => {
    const mark = selected.has(c.code) ? '✅ ' : '';
    const label = `${mark}${c.code.toUpperCase()} - ${c.name}`;
    return [Markup.button.callback(label.slice(0, 64), `sp:${interactionId}:toggle:${c.code}`)];
  });

  const navRow = [];
  if (clampedPage > 0) {
    navRow.push(Markup.button.callback('◀ Prev', `sp:${interactionId}:page:${clampedPage - 1}`));
  }
  navRow.push(Markup.button.callback(`${clampedPage + 1}/${totalPages}`, `sp:${interactionId}:noop`));
  if (clampedPage < totalPages - 1) {
    navRow.push(Markup.button.callback('Next ▶', `sp:${interactionId}:page:${clampedPage + 1}`));
  }
  rows.push(navRow);
  rows.push([Markup.button.callback('🗑 Clear All', `sp:${interactionId}:clear:${clampedPage}`)]);

  return Markup.inlineKeyboard(rows);
}

// includeCopyButtons: false for inline-mode results, true for normal chat messages
function convertKeyboard(interactionId, results, includeCopyButtons) {
  const rows = [[Markup.button.callback('🔄 Refresh', `cv:${interactionId}:refresh`)]];
  if (includeCopyButtons) {
    for (const r of results) {
      rows.push([
        {
          text: `📋 Copy ${r.code.toUpperCase()}`,
          copy_text: { text: r.formatted },
        },
      ]);
    }
  }
  return Markup.inlineKeyboard(rows);
}

module.exports = { PAGE_SIZE, mainMenuKeyboard, setPreferredKeyboard, convertKeyboard };
