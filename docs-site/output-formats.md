# Output Formats

Every rates endpoint can return JSON, CSV, or NDJSON.

## JSON (default)

Plain `Accept: application/json`, or just omit the header entirely: this is the default for every example in these docs.

## CSV

Append `.csv` to the path, or send `Accept: text/csv`:

```
curl https://api.currency.uwuapps.org/v2/rates.csv
```

## NDJSON

Newline-delimited JSON, useful for large time series since it avoids buffering the whole response before you can start processing it. Send `Accept: application/x-ndjson`:

```
curl -H "Accept: application/x-ndjson" "https://api.currency.uwuapps.org/v2/rates?from=2026-01-01"
```

> NDJSON pairs well with streaming parsers when pulling multi-year, multi-currency time series. See [Time Series](https://docs.api.currency.uwuapps.org/rates-timeseries) for the params that shape that request.

---
*Interactive version: https://docs.api.currency.uwuapps.org/output-formats*
