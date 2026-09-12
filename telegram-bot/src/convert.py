from . import currency, db
from .format import escape_md, format_number, table
from .keyboards import convert_keyboard
from .reply import send_rich_message


# Computes conversion of `amount` in `base_code` into every one of the
# user's preferred currencies. Returns None if the user has no preferences.
async def compute_conversion(user_id, amount, base_code, force=False):
    preferred = db.get_preferences(user_id)
    if not preferred:
        return None

    base = base_code.lower()
    result = await currency.get_rates(base, force=force)
    date, rates = result['date'], result['rates']

    results = []
    for target_code in preferred:
        if target_code == base:
            rate = 1
        elif target_code in rates:
            rate = rates[target_code]
        else:
            continue  # currency not present for this base (e.g. delisted), skip quietly
        value = amount * rate
        results.append({'code': target_code, 'value': value, 'formatted': format_number(value)})

    return {'date': date, 'base': base, 'amount': amount, 'results': results}


# Builds the conversion result as a Rich Message: a heading, a table of
# preferred currency -> converted amount, and the rate date. The fallback
# carries the same information as plain text.
def build_conversion_view(conversion, interaction_id, include_copy_buttons):
    date, base, amount, results = (
        conversion['date'],
        conversion['base'],
        conversion['amount'],
        conversion['results'],
    )
    title = f'Converting {format_number(amount)} {base.upper()}'

    if not results:
        note = 'None of your preferred currencies have rate data for this base right now.'
        rich = {
            'markdown': f'# {escape_md(title)}\n\n{note}',
            'fallback': f'{title}\n\n{note}',
        }
    else:
        rich = {
            'markdown': (
                f'# {escape_md(title)}\n\n'
                + table(['Amount'], [(r['code'].upper(), r['formatted']) for r in results])
                + f'\n\n*Rates as of {escape_md(date)}*'
            ),
            'fallback': (
                f'{title}\n\n'
                + '\n'.join(f"{r['code'].upper()}: {r['formatted']}" for r in results)
                + f'\n\nRates as of {date}'
            ),
        }

    buttons = convert_keyboard(interaction_id, results, include_copy_buttons)
    return rich, buttons


# Sends a fresh conversion result as a new chat message, backed by an
# `interactions` row so the Refresh/Copy buttons keep working after restarts.
async def send_conversion(event, user_id, amount, base_code):
    conversion = await compute_conversion(user_id, amount, base_code)
    if not conversion:
        return await event.respond(
            'You have not picked any preferred currencies yet. Use /setpreferred first.',
            parse_mode='md',
        )

    interaction_id = db.create_interaction('convert', user_id, {'amount': amount, 'base': base_code.lower()})
    rich, buttons = build_conversion_view(conversion, interaction_id, True)
    return await send_rich_message(event.client, event.chat_id, rich, buttons)
