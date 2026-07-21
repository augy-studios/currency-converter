# Single Pair Rate

Fetch one base/quote currency pair in a single call.

GET `/v2/rate/{base}/{quote}`

```
curl https://api.currency.uwuapps.org/v2/rate/EUR/USD
```

## Path and query parameters

| Param | Type | Description |
| --- | --- | --- |
| `base` | path | Base currency code, e.g. `EUR`. |
| `quote` | path | Target currency code, e.g. `USD`. |
| `date` | query | Optional. Same behaviour as [Historical Rates](https://docs.api.currency.uwuapps.org/rates-historical). |
| `providers` | query | Optional. Pin to one data source, e.g. `ECB`. |

## Try it

*Interactive console omitted here - try it on the live page.*

## Response

```
{ "date": "2026-07-21", "base": "EUR", "quote": "USD", "rate": 1.161 }
```

> This is the endpoint the [Currency Conversion](https://docs.api.currency.uwuapps.org/conversion) recipe is built on.

---
*Interactive version: https://docs.api.currency.uwuapps.org/single-pair*
