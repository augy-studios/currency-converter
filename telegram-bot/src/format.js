// Escapes text for Telegram MarkdownV2. Use for any plain text placed
// outside of a code span (`...`) or bold/italic markers you add yourself.
const RESERVED = /[_*\[\]()~`>#+\-=|{}.!\\]/g;

function escapeMd(text) {
  return String(text).replace(RESERVED, '\\$&');
}

// Wraps text in a MarkdownV2 inline code span. Content inside a code span
// only needs backslash and backtick escaped, so numbers/codes are safe as-is.
function code(text) {
  const safe = String(text).replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  return `\`${safe}\``;
}

// Formats a numeric conversion result: up to 6 decimal places, trimmed of
// trailing zeros, with no thousands separators (keeps it easy to copy).
function formatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  let str = value.toFixed(6);
  str = str.replace(/0+$/, '').replace(/\.$/, '');
  if (str === '' || str === '-0') str = '0';
  return str;
}

module.exports = { escapeMd, code, formatNumber };
