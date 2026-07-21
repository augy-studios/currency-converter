# Currency API Docs

Documentation site for `api.currency.uwuapps.org`, deployed separately from
the main converter app at `docs.api.currency.uwuapps.org`.

Static HTML/CSS/JS, no build step required to deploy — the `.html` files at
the root are already built. Vercel serves this directory as-is.

## Editing content

The pages are generated from `_build/template.html` (the shared shell: topbar,
sidebar, modals, scripts) plus one content fragment per page in
`_build/pages/*.html`. `_build/pages.json` lists each page's id, output
filename, title, and meta description.

To change a page's content, edit its fragment under `_build/pages/`, then
regenerate:

```bash
node _build/generate.js
```

This overwrites the corresponding `.html` file at the project root. `_build/`
itself is excluded from the Vercel deployment via `.vercelignore` — it's a
source folder, not part of the served site.

To add a new page: add an entry to `_build/pages.json`, create the matching
fragment in `_build/pages/`, add it to the `NAV` array in `js/nav-data.js`
(so it shows up in the sidebar, search, and prev/next pager), then run the
generator.

## Structure

- `css/theme.css` — the 7-theme colour system (shared contract with the main
  converter app's `--bg`/`--accent`/etc. variables).
- `css/docs.css` — layout: topbar, sidebar, content, table of contents,
  search modal, try-it console, tables, code blocks.
- `js/nav-data.js` — single source of truth for the sidebar structure and
  search index entries.
- `js/theme.js`, `js/nav.js`, `js/search.js`, `js/try-it.js` — shared
  behaviour included on every page.
- `manifest.json`, `sw.js` — PWA install + offline caching for the docs
  themselves (not the live API — API responses are never cached).

## Deploying

Push this directory as its own Vercel project (root directory = `docs-site`)
and point `docs.api.currency.uwuapps.org` at it. No environment variables,
serverless functions, or database are required — the "Try it" console on
each endpoint page calls `https://api.currency.uwuapps.org` directly from
the browser.

If a browser "Try it" request ever fails with a CORS error, add permissive
CORS headers to the Frankfurter reverse-proxy config on the VPS, e.g. in the
Nginx server block for `api.currency.uwuapps.org`:

```
add_header 'Access-Control-Allow-Origin' '*' always;
```

That's the only VPS-side change this docs site could ever need — everything
else about it is static hosting.
