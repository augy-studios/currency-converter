# Currency Exchange API

Self-hosted instance of [Frankfurter](https://frankfurter.dev), running on a Debian VPS via Docker, proxied through Nginx with TLS. Daily exchange rates from 84 central banks, 201 currencies, back to 1948.

```
curl https://api.currency.uwuapps.org/v2/rates
```

- **Base URL:** `https://api.currency.uwuapps.org`
- **Authentication:** None required
- **Coverage:** 201 currencies, 84 central banks, back to 1948
- **Rate limits:** None

## Explore the docs

- [Quick Start](https://docs.api.currency.uwuapps.org/quickstart): Make your first request in under a minute.
- [Endpoints](https://docs.api.currency.uwuapps.org/rates-latest): Latest, historical, and time-series exchange rates.
- [Guides](https://docs.api.currency.uwuapps.org/charting): Chart historical rates, pick an output format.
- [Reference](https://docs.api.currency.uwuapps.org/errors): Error codes and operational notes.

## Why self-hosted?

This instance runs the open-source [Frankfurter](https://github.com/lineofflight/frankfurter) project on infrastructure Augy controls. Being self-hosted doesn't make it faster than the public API, since it's still the same underlying provider data, refreshed on the same daily schedule.

> Curious about uptime, update frequency, or provider quirks? See the [FAQ & Operational Notes](https://docs.api.currency.uwuapps.org/faq).

---
*Interactive version: https://docs.api.currency.uwuapps.org/*
