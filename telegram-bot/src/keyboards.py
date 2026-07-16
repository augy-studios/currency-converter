from telethon import Button
from telethon.tl import types

PAGE_SIZE = 8


def main_menu_keyboard():
    return [
        [Button.url('Open Web App', 'https://currency.uwuapps.org/')],
        [Button.url('Donate', 'https://donate.stripe.com/28o2akeAr3hv0DK6oo')],
    ]


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

    nav_row = []
    if clamped_page > 0:
        nav_row.append(Button.inline('◀ Prev', f'sp:{interaction_id}:page:{clamped_page - 1}'.encode()))
    nav_row.append(Button.inline(f'{clamped_page + 1}/{total_pages}', f'sp:{interaction_id}:noop'.encode()))
    if clamped_page < total_pages - 1:
        nav_row.append(Button.inline('Next ▶', f'sp:{interaction_id}:page:{clamped_page + 1}'.encode()))
    rows.append(nav_row)

    rows.append([Button.inline('🗑 Clear All', f'sp:{interaction_id}:clear:{clamped_page}'.encode())])
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
