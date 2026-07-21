# Latest Rates

Today's blended exchange rates, with EUR as the default base currency.

GET `/v2/rates`

```
curl https://api.currency.uwuapps.org/v2/rates
```

## Query parameters

| Param | Type | Description |
| --- | --- | --- |
| `base` | string | Change the base currency (default `EUR`). |
| `quotes` | string | Comma-separated list to filter target currencies, e.g. `USD,GBP`. |
| `providers` | string | Pin to one data source instead of the blended default, e.g. `ECB`. See [Providers](https://docs.api.currency.uwuapps.org/providers). |
| `expand` | string | Set to `providers` to see which sources contributed to each rate. |

## Change base currency

```
curl https://api.currency.uwuapps.org/v2/rates?base=USD
```

## Filter to specific target currencies

```
curl https://api.currency.uwuapps.org/v2/rates?quotes=USD,GBP
```

## Try it

*Interactive console omitted here - try it on the live page.*

## Response

```
[
  { "date": "2026-07-21", "base": "EUR", "quote": "USD", "rate": 1.161 },
  { "date": "2026-07-21", "base": "EUR", "quote": "GBP", "rate": 0.866 }
]
```

---
*Interactive version: https://docs.api.currency.uwuapps.org/rates-latest*
