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
