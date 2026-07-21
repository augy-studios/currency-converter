# Historical Rates

Exchange rates for a single date, back to 1948.

GET `/v2/rates`

```
curl https://api.currency.uwuapps.org/v2/rates?date=1999-01-04
```

## Query parameters

| Param | Type | Description |
| --- | --- | --- |
| `date` | string | A single date as `YYYY-MM-DD`. |
| `base` | string | Change the base currency (default `EUR`). |
| `quotes` | string | Comma-separated list to filter target currencies. |
| `providers` | string | Pin to one data source, e.g. `ECB`. |

## Try it

*Interactive console omitted here - try it on the live page.*

> Weekends and bank holidays have no published rate for most providers, so the response carries forward the most recent prior business day's rate for that date.

## Response

```
[
  { "date": "1999-01-04", "base": "EUR", "quote": "USD", "rate": 1.1789 }
]
```

---
*Interactive version: https://docs.api.currency.uwuapps.org/rates-historical*
