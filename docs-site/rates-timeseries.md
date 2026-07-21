# Time Series

Exchange rates across a date range, optionally downsampled by week or month.

GET `/v2/rates`

```
curl "https://api.currency.uwuapps.org/v2/rates?from=2026-01-01&quotes=USD"
```

## Query parameters

| Param | Type | Description |
| --- | --- | --- |
| `from` | string | Start date, `YYYY-MM-DD`. |
| `to` | string | End date. Omit to default to today. |
| `quotes` | string | Comma-separated target currencies to include. |
| `group` | `week` \| `month` | Downsample the series to reduce payload size on long ranges. |
| `base` | string | Change the base currency (default `EUR`). |

## Bounding the end date

```
curl "https://api.currency.uwuapps.org/v2/rates?from=2026-01-01&to=2026-06-01&quotes=USD"
```

## Downsampling a long range

```
curl "https://api.currency.uwuapps.org/v2/rates?from=2026-01-01&group=month"
```

## Try it

*Interactive console omitted here - try it on the live page.*

## Response shape

A time-series call returns a **flat array**, with one row per date/currency pair rather than rows grouped by date:

```
[
  {"date":"2026-07-01","base":"EUR","quote":"USD","rate":1.161},
  {"date":"2026-07-01","base":"EUR","quote":"GBP","rate":0.866},
  {"date":"2026-07-02","base":"EUR","quote":"USD","rate":1.159},
  {"date":"2026-07-02","base":"EUR","quote":"GBP","rate":0.867}
]
```

See [Charting Historical Data](https://docs.api.currency.uwuapps.org/charting) for how to group these rows into per-currency series for a chart or a pandas DataFrame.

---
*Interactive version: https://docs.api.currency.uwuapps.org/rates-timeseries*
