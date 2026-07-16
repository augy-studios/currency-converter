from telethon import Button
from telethon.tl import types

PAGE_SIZE = 8


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


def set_preferred_keyboard(interaction_id, page, currencies, selected):
    total_pages = max(1, -(-len(currencies) // PAGE_SIZE))  # ceil division
    clamped_page = min(max(page, 0), total_pages - 1)
    start = clamped_page * PAGE_SIZE
    page_items = currencies[start:start + PAGE_SIZE]

    rows = []
    for c in page_items:
        mark = '✅ ' if c['code'] in selected else ''
        label = f"{mark}{c['code'].upper()} - {c['name']}"[:64]
        data = f"sp:{interaction_id}:toggle:{c['code']}".encode()
        rows.append([Button.inline(label, data)])

    rows.append(_nav_row('sp', interaction_id, clamped_page, total_pages))
    rows.append([Button.inline('🗑 Clear All', f'sp:{interaction_id}:clear:{clamped_page}'.encode())])
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
    return rows


# include_copy_buttons: False for inline-mode results, True for normal chat messages
def convert_keyboard(interaction_id, results, include_copy_buttons):
    rows = [[Button.inline('🔄 Refresh', f'cv:{interaction_id}:refresh'.encode())]]
    if include_copy_buttons:
        for r in results:
            rows.append([
                types.KeyboardButtonCopy(text=f"📋 Copy {r['code'].upper()}", copy_text=r['formatted'])
            ])
    return rows
