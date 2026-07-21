# Charting Historical Data

A time-series call returns a flat array, with one row per date/currency pair rather than rows grouped by date. Group it before you chart it.

## The flat row shape

```
[
  {"date":"2026-07-01","base":"EUR","quote":"USD","rate":1.161},
  {"date":"2026-07-01","base":"EUR","quote":"GBP","rate":0.866},
  {"date":"2026-07-02","base":"EUR","quote":"USD","rate":1.159},
  {"date":"2026-07-02","base":"EUR","quote":"GBP","rate":0.867}
]
```

To chart it, group the rows by `quote` into separate series, keyed on `date`.

## Chart.js example

A self-contained example that plots one or more currencies against a base over a date range:

```
<canvas id="fxChart"></canvas>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script>
async function renderFxChart({ base = "EUR", quotes = ["USD", "GBP"], from, to }) {
  const url = `https://api.currency.uwuapps.org/v2/rates?base=${base}&quotes=${quotes.join(",")}&from=${from}${to ? `&to=${to}` : ""}`;
  const rows = await fetch(url).then(r => r.json());

  // Group flat rows into { quote: { date: rate } }
  const series = {};
  const dateSet = new Set();
  for (const row of rows) {
    series[row.quote] ??= {};
    series[row.quote][row.date] = row.rate;
    dateSet.add(row.date);
  }
  const labels = [...dateSet].sort();

  const datasets = Object.entries(series).map(([quote, byDate]) => ({
    label: `${base}/${quote}`,
    data: labels.map(d => byDate[d] ?? null),
    spanGaps: true,
    tension: 0.2,
  }));

  new Chart(document.getElementById("fxChart"), {
    type: "line",
    data: { labels, datasets },
    options: { responsive: true, scales: { y: { beginAtZero: false } } },
  });
}

renderFxChart({ base: "EUR", quotes: ["USD", "GBP", "JPY"], from: "2026-01-01" });
</script>
```

## Notes

- `spanGaps: true` handles weekends/holidays where no new rate is published, so the line just carries over instead of breaking.
- For a long range (multi-year, many currencies), use `group=month` or `group=week` on the request to downsample before it reaches the browser (see [Time Series](https://docs.api.currency.uwuapps.org/rates-timeseries)).

## Python / pandas instead

For a quick analysis script rather than a web chart, fetch the same endpoint, load the JSON straight into a DataFrame, then pivot before plotting:

```
import pandas as pd
import requests

rows = requests.get(
    "https://api.currency.uwuapps.org/v2/rates",
    params={"base": "EUR", "quotes": "USD,GBP", "from": "2026-01-01"},
).json()

df = pd.json_normalize(rows)
wide = df.pivot(index="date", columns="quote", values="rate")
wide.plot()
```

---
*Interactive version: https://docs.api.currency.uwuapps.org/charting*
