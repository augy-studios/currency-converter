import re

# Telethon parses outgoing message text as Markdown client-side (building
# message entities itself) rather than relying on Telegram's server-side
# MarkdownV2 parse mode. Its parser (telethon.extensions.markdown) is a
# simple delimiter matcher with NO backslash-escape support at all - a
# literal backslash is left in the output rather than escaping anything.
# Delimiters: **bold**, __italic__, ~~strike~~, `code`, ```pre```.
#
# That means dynamic values must never contain those delimiter characters
# if they're interpolated into formatted text. Every value we wrap in
# code() today (currency codes, formatted numbers, ISO dates) is already
# restricted to letters/digits/./- by validation upstream, so this holds
# in practice - there is no working way to escape a stray backtick here.
#
# This only applies to one-line notices still sent through event.respond().
# Structured replies (headings, tables) go through src/reply.py as genuine
# Telegram Rich Messages, whose markdown dialect DOES honour backslash
# escapes - use escape_md()/escape_cell() below for those.
def code(text):
    return f'`{text}`'


# Formats a numeric conversion result: up to 6 decimal places, trimmed of
# trailing zeros, with no thousands separators (keeps it easy to copy).
def format_number(value):
    if value != value or value in (float('inf'), float('-inf')):  # NaN / inf guard
        return str(value)
    text = f'{value:.6f}'
    text = text.rstrip('0').rstrip('.')
    if text in ('', '-0'):
        text = '0'
    return text


# --- Rich Markdown (Telegram Rich Messages) -------------------------------
#
# Every piece of dynamic data (currency names, user input, API strings) that
# is interpolated into a rich message's markdown must pass through
# escape_md(); table cell contents through escape_cell(). Markup we author
# ourselves (`#`, `|`, `**`) is written literally and never escaped.

_MD_SPECIAL = re.compile(r'([\\*_~`|\[\]#>=])')


def escape_md(text) -> str:
    """Escape user/data text for Telegram's Rich Markdown dialect."""
    return _MD_SPECIAL.sub(r'\\\1', str(text))


def escape_cell(text) -> str:
    """Escape for a GFM table cell; also flattens newlines so the row stays intact."""
    return escape_md(str(text).replace('\n', ' '))


# Renders a GFM pipe table. The first column is a row-label column with a
# blank header, so each row must have len(headers) + 1 values: the label
# followed by one value per header.
def table(headers, rows) -> str:
    lines = [
        '| ' + ' | '.join(['', *headers]) + ' |',
        '| ' + ' | '.join(['---'] * (len(headers) + 1)) + ' |',
    ]
    for row in rows:
        lines.append('| ' + ' | '.join(escape_cell(v) for v in row) + ' |')
    return '\n'.join(lines)
