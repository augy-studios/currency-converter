import re

# Telethon parses outgoing message text as Markdown client-side (building
# message entities itself) rather than relying on Telegram's server-side
# MarkdownV2 parse mode, so only Telethon's own markdown syntax characters
# need escaping here - not the full MarkdownV2 reserved set.
_RESERVED = re.compile(r'[\\*_`\[\]~|]')


def escape_md(text):
    return _RESERVED.sub(lambda m: '\\' + m.group(0), str(text))


# Wraps text in a Markdown inline code span. Content inside a code span only
# needs backslash and backtick escaped.
def code(text):
    safe = str(text).replace('\\', '\\\\').replace('`', '\\`')
    return f'`{safe}`'


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
