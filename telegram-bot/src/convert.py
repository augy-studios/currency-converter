from . import currency, db
from .format import code, format_number
from .keyboards import convert_keyboard


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


def build_conversion_message(conversion):
    date, base, amount, results = (
        conversion['date'],
        conversion['base'],
        conversion['amount'],
        conversion['results'],
    )
    amount_str = format_number(amount)
    header = f"**Converting** {code(f'{amount_str} {base.upper()}')}"

    if not results:
        return f'{header}\n\nNone of your preferred currencies have rate data for this base right now.'

    lines = [f"**{r['code'].upper()}:** {code(r['formatted'])}" for r in results]
    return f"{header}\n\n" + '\n'.join(lines) + f"\n\n_Rates as of {code(date)}_"


# Sends a fresh conversion result as a new chat message, backed by an
# `interactions` row so the Refresh/Copy buttons keep working after restarts.
async def send_conversion(event, user_id, amount, base_code):
    conversion = await compute_conversion(user_id, amount, base_code)
    if not conversion:
        return await event.respond(
            'You have not picked any preferred currencies yet. Use /setpreferred first.'
        )

    interaction_id = db.create_interaction('convert', user_id, {'amount': amount, 'base': base_code.lower()})
    text = build_conversion_message(conversion)
    buttons = convert_keyboard(interaction_id, conversion['results'], True)
    return await event.respond(text, buttons=buttons, parse_mode='md', link_preview=False)
