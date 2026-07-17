from telethon import Button
from telethon.tl import types

PAGE_SIZE = 8

GRAPH_RANGES = ['5d', '1w', '1m', '1y', '5y', 'max']
GRAPH_RANGE_LABELS = {'5d': '5D', '1w': '1W', '1m': '1M', '1y': '1Y', '5y': '5Y', 'max': 'Max'}


def main_menu_keyboard():
    return [
        [Button.url('Open Web App', 'https://currency.uwuapps.org/')],
        [Button.url('Donate', 'https://donate.stripe.com/28o2akeAr3hv0DK6oo')],
    ]


def _nav_row(prefix, interaction_id, clamped_page, total_pages):
    nav_row = []
    if clamped_page > 0:
        nav_row.append(Button.inline('◀ Prev', f'{prefix}:{interaction_id}:page:{clamped_page - 1}'.encode()))
    nav_row.append(Button.inline(f'{clamped_page + 1}/{total_pages}', f'{prefix}:{interaction_id}:noop'.encode()))
    if clamped_page < total_pages - 1:
        nav_row.append(Button.inline('Next ▶', f'{prefix}:{interaction_id}:page:{clamped_page + 1}'.encode()))
    return nav_row


def set_preferred_keyboard(interaction_id, page, currencies, selected, show_preferred=False):
    shown = [c for c in currencies if c['code'] in selected] if show_preferred else currencies
    total_pages = max(1, -(-len(shown) // PAGE_SIZE))  # ceil division
    clamped_page = min(max(page, 0), total_pages - 1)
    start = clamped_page * PAGE_SIZE
    page_items = shown[start:start + PAGE_SIZE]

    rows = []
    for c in page_items:
        mark = '✅ ' if c['code'] in selected else ''
        label = f"{mark}{c['code'].upper()} - {c['name']}"[:64]
        data = f"sp:{interaction_id}:toggle:{c['code']}".encode()
        rows.append([Button.inline(label, data)])

    rows.append(_nav_row('sp', interaction_id, clamped_page, total_pages))
    toggle_view = (
        Button.inline('📋 Show All', f'sp:{interaction_id}:showall'.encode())
        if show_preferred else
        Button.inline('⭐ Show Preferred', f'sp:{interaction_id}:showpref'.encode())
    )
    rows.append([toggle_view, Button.inline('✅ Done', f'sp:{interaction_id}:done'.encode())])
    return rows


def remove_preferred_keyboard(interaction_id, page, currencies):
    total_pages = max(1, -(-len(currencies) // PAGE_SIZE))  # ceil division
    clamped_page = min(max(page, 0), total_pages - 1)
    start = clamped_page * PAGE_SIZE
    page_items = currencies[start:start + PAGE_SIZE]

    rows = []
    for c in page_items:
        label = f"❌ {c['code'].upper()} - {c['name']}"[:64]
        data = f"rp:{interaction_id}:remove:{c['code']}".encode()
        rows.append([Button.inline(label, data)])

    rows.append(_nav_row('rp', interaction_id, clamped_page, total_pages))
    rows.append([Button.inline('✅ Done', f'rp:{interaction_id}:done'.encode())])
    return rows


# include_copy_buttons: False for inline-mode results, True for normal chat messages.
# The Graph button is included either way.
def convert_keyboard(interaction_id, results, include_copy_buttons):
    rows = [[Button.inline('🔄 Refresh', f'cv:{interaction_id}:refresh'.encode())]]
    if include_copy_buttons:
        for r in results:
            rows.append([
                types.KeyboardButtonCopy(text=f"📋 Copy {r['code'].upper()}", copy_text=r['formatted'])
            ])
    rows.append([Button.inline('📈 Graph', f'cv:{interaction_id}:graph'.encode())])
    return rows


def graph_keyboard(interaction_id, range_key):
    range_row = [
        Button.inline(
            ('• ' if r == range_key else '') + GRAPH_RANGE_LABELS[r],
            f'gr:{interaction_id}:range:{r}'.encode(),
        )
        for r in GRAPH_RANGES
    ]
    rows = [range_row[:3], range_row[3:]]
    rows.append([
        Button.inline('➕ Add currency', f'gr:{interaction_id}:add'.encode()),
        Button.inline('➖ Remove currency', f'gr:{interaction_id}:remove'.encode()),
    ])
    return rows


def graph_remove_keyboard(interaction_id, quotes):
    rows = [
        [Button.inline(f'❌ {q.upper()}', f'gr:{interaction_id}:doremove:{q}'.encode())]
        for q in quotes
    ]
    rows.append([Button.inline('⬅ Back', f'gr:{interaction_id}:back'.encode())])
    return rows
