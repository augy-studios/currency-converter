import io
from datetime import datetime

import matplotlib

matplotlib.use('Agg')

import matplotlib.dates as mdates
import matplotlib.pyplot as plt

# Fixed-order categorical palette (light-mode steps from the shared design
# system) — never cycled/reassigned, so a given currency keeps its color as
# long as it stays in the comparison set.
COLORS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948']


def _color(index):
    return COLORS[index % len(COLORS)]


# base: currency code (str). series: ordered dict-like of
# {quote_code: [(date_str, rate), ...]}, already sorted by date.
def render_graph(base, series):
    non_empty = {q: points for q, points in series.items() if points}
    indexed = len(non_empty) > 1

    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    fig.patch.set_facecolor('#fcfcfb')
    ax.set_facecolor('#fcfcfb')

    for i, (quote, points) in enumerate(series.items()):
        if not points:
            continue
        dates = [datetime.strptime(d, '%Y-%m-%d') for d, _ in points]
        rates = [r for _, r in points]
        # With 2+ quotes, absolute rates can sit on wildly different scales
        # (e.g. JPY ~150 vs MYR ~4) — a shared linear axis would flatten the
        # smaller series to invisibility. Index each series to 100 at its
        # first point so multiple currencies stay comparable on one axis.
        if indexed:
            rates = [(r / rates[0]) * 100 for r in rates]
        ax.plot(dates, rates, label=quote.upper(), color=_color(i), linewidth=1.8)

    title = f'{base.upper()} exchange rate history'
    ax.set_title(title, color='#0b0b0b', fontsize=13)
    ax.set_ylabel('Indexed (100 = start of range)' if indexed else '', color='#52514e', fontsize=9)
    ax.grid(True, color='#e1e0d9', linewidth=0.8)
    ax.spines[['top', 'right']].set_visible(False)
    ax.spines[['left', 'bottom']].set_color('#c3c2b7')
    ax.tick_params(colors='#52514e', labelsize=9)
    ax.xaxis.set_major_locator(mdates.AutoDateLocator(minticks=4, maxticks=8))
    ax.xaxis.set_major_formatter(mdates.ConciseDateFormatter(ax.xaxis.get_major_locator()))

    if len(series) > 1:
        ax.legend(frameon=False, labelcolor='#0b0b0b', fontsize=9)

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format='png', facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    buf.name = 'graph.png'
    return buf
