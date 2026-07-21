# FAQ & Operational Notes

Things worth knowing about this specific instance, beyond the endpoint reference.

## How often do rates update?

Roughly daily, around 16:00 CET from the ECB, with other providers updating on their own schedules through the day. Self-hosting doesn't make this instance faster than the public Frankfurter API, since it's the same underlying provider data either way.

## Are there rate limits?

No request quota. This is a self-hosted instance rather than a shared public one, so there's no per-key throttling to plan around. Still, be a good citizen with it: cache responses on your end where it makes sense rather than re-fetching the same data in a tight loop.

## Can I call this directly from browser JavaScript?

Yes. The endpoints are meant to be called client-side as well as server-side, and every example in these docs (including the [Quick Start](https://docs.api.currency.uwuapps.org/quickstart) and the [Chart.js guide](https://docs.api.currency.uwuapps.org/charting)) does exactly that with a plain `fetch()`, no proxy involved.

## What's the uptime like?

The service is configured to restart automatically if it or the host ever goes down, and TLS stays valid via automatic certificate renewal. As with any single-instance deployment, brief downtime during a redeploy or host maintenance window is possible, since there's no multi-region failover behind this API.

## Does historical data ever change or disappear?

Rate history is stored durably and survives routine restarts and redeploys. Once a date's rates are published they aren't expected to change retroactively, aside from rare upstream corrections from a provider.

## I see an occasional provider error in a response. Is that a problem?

Not usually. With 84 central bank adapters running on a schedule, an isolated parsing hiccup from a single provider on a single date is normal and doesn't affect the other providers or currencies. See [Providers](https://docs.api.currency.uwuapps.org/providers) for when it's actually worth flagging.

## Something looks wrong. Who do I tell?

This API backs the [Frankfurter](https://frankfurter.dev) project's public data, run by Augy. If a rate looks off or an endpoint is behaving unexpectedly, reach out at [augy@augystudios.com](mailto:augy@augystudios.com).

---
*Interactive version: https://docs.api.currency.uwuapps.org/faq*
