# Quick Start

Point a request at the base URL below and you're reading live exchange rates.

## Base URL

Every endpoint hangs off this base:

```
https://api.currency.uwuapps.org
```

## Your first request

Fetch today's blended rates with EUR as the default base:

```
curl https://api.currency.uwuapps.org/v2/rates
```

*Interactive console omitted here - try it on the live page.*

## Response shape

A latest-rates call returns a flat array of base/quote rows:

```
[
  { "date": "2026-07-21", "base": "EUR", "quote": "USD", "rate": 1.161 },
  { "date": "2026-07-21", "base": "EUR", "quote": "GBP", "rate": 0.866 }
]
```

## No authentication

Nothing to sign up for and no key to generate. Call the endpoints directly from a script, a server, or client-side JavaScript.

> Calling the API straight from browser JavaScript works out of the box. See the [CORS note](https://docs.api.currency.uwuapps.org/faq#cors) in the FAQ if you're proxying it instead.

## Next steps

- [Latest Rates](https://docs.api.currency.uwuapps.org/rates-latest): change the base currency or filter to specific quotes.
- [Time Series](https://docs.api.currency.uwuapps.org/rates-timeseries): pull a date range for charting.
- [Currencies](https://docs.api.currency.uwuapps.org/currencies): look up supported codes and names.

---
*Interactive version: https://docs.api.currency.uwuapps.org/quickstart*
