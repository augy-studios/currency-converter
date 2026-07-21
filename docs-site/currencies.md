# Currencies

List and inspect the currencies this instance has data for.

## List all available currencies

GET `/v2/currencies`

```
curl https://api.currency.uwuapps.org/v2/currencies
```

*Interactive console omitted here - try it on the live page.*

## Include legacy/retired currencies

```
curl https://api.currency.uwuapps.org/v2/currencies?scope=all
```

*Interactive console omitted here - try it on the live page.*

## Details for one currency

GET `/v2/currency/{code}`

```
curl https://api.currency.uwuapps.org/v2/currency/EUR
```

*Interactive console omitted here - try it on the live page.*

Returns the currency's name, symbol, earliest available `start_date`, and which providers cover it.

---
*Interactive version: https://docs.api.currency.uwuapps.org/currencies*
