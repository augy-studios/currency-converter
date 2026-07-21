# Providers

Rates are blended across 84 central bank data sources by default. You can inspect them or pin to just one.

## List all data sources

GET `/v2/providers`

```
curl https://api.currency.uwuapps.org/v2/providers
```

*Interactive console omitted here - try it on the live page.*

## Pin to one provider

Every rates endpoint accepts `providers` to use official reference rates from a single source instead of the blended default, e.g. the ECB:

```
curl https://api.currency.uwuapps.org/v2/rates?providers=ECB
```

## See which providers contributed

```
curl https://api.currency.uwuapps.org/v2/rates?expand=providers
```

> Pegged-currency rows omit the `providers` field in an expanded response, since those rates come from the peg rather than provider data.

## Provider quirks

84 central bank adapters are pulled on a cron loop. Occasional single-provider errors are normal, since the scheduler catches and logs them per-adapter without affecting the others. This is only worth investigating if the same error repeats every cycle for a currency you rely on, or several providers fail at once. A handful of providers (BAM, BANXICO, BCCH, BOT, FRED, TCMB) accept an optional API key upstream and may behave inconsistently without one configured; see the [Frankfurter deploy guide](https://frankfurter.dev/deploy/) for details.

---
*Interactive version: https://docs.api.currency.uwuapps.org/providers*
