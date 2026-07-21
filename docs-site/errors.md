# Errors

Standard HTTP status codes with a small JSON error body.

## Error body shape

```
{ "message": "Could not find currency ABC" }
```

## Status codes

| Code | Meaning |
| --- | --- |
| `400` | Invalid parameter or malformed request. |
| `404` | Currency, rate, or resource not found. |
| `422` | Request understood but cannot be processed. |

## Handling errors

Check `res.ok` (or the status code) before parsing the body as a successful response, since the shape is different on failure:

```
const res = await fetch(url);
if (!res.ok) {
  const { message } = await res.json();
  throw new Error(message);
}
const data = await res.json();
```

---
*Interactive version: https://docs.api.currency.uwuapps.org/errors*
