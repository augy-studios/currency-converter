# Currency Conversion

There's no dedicated `/convert` endpoint. Fetch the rate and do the math client-side.

## Recipe

```
async function convert(base, quote, amount) {
  const api = "https://api.currency.uwuapps.org";
  const res = await fetch(`${api}/v2/rate/${base}/${quote}`);
  const data = await res.json();
  return (amount * data.rate).toFixed(2);
}

convert("EUR", "USD", 10).then(result => console.log(`10 EUR = ${result} USD`));
```

## Try it

Uses the same [Single Pair Rate](https://docs.api.currency.uwuapps.org/single-pair) endpoint under the hood.

*Interactive console omitted here - try it on the live page.*

## Rounding and precision

Rates are returned as full-precision floats, so round only at display time. If you're chaining conversions (e.g. USD → EUR → JPY), convert through the raw rate at each step rather than rounding intermediate amounts, or small errors compound.

## Doing it server-side instead

The same recipe works from any backend language: fetch `/v2/rate/{base}/{quote}` with your HTTP client of choice and multiply. Nothing about it is browser-specific; the fetch example above is just the shortest way to show it.

---
*Interactive version: https://docs.api.currency.uwuapps.org/conversion*
