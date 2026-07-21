/* ─── Docs navigation + search source of truth ───
   Every page pulls its sidebar links from here, and search.js indexes
   these entries (plus in-page headings) for the Ctrl+K search modal. */

const NAV = [
  {
    group: 'Getting Started',
    items: [
      { id: 'index', title: 'Overview', url: '/', desc: 'What this API is and how it is hosted' },
      { id: 'quickstart', title: 'Quick Start', url: '/quickstart', desc: 'Your first request, no API key needed' },
    ],
  },
  {
    group: 'Endpoints',
    items: [
      { id: 'rates-latest', title: 'Latest Rates', url: '/rates-latest', method: 'GET', desc: "Today's blended exchange rates" },
      { id: 'rates-historical', title: 'Historical Rates', url: '/rates-historical', method: 'GET', desc: 'Rates for a single past date' },
      { id: 'rates-timeseries', title: 'Time Series', url: '/rates-timeseries', method: 'GET', desc: 'Rates across a date range, with grouping' },
      { id: 'single-pair', title: 'Single Pair Rate', url: '/single-pair', method: 'GET', desc: 'One base/quote pair in one call' },
      { id: 'conversion', title: 'Currency Conversion', url: '/conversion', desc: 'Convert an amount client-side' },
      { id: 'currencies', title: 'Currencies', url: '/currencies', method: 'GET', desc: 'List and inspect supported currencies' },
      { id: 'providers', title: 'Providers', url: '/providers', method: 'GET', desc: 'The 84 central banks behind the data' },
    ],
  },
  {
    group: 'Guides',
    items: [
      { id: 'charting', title: 'Charting Historical Data', url: '/charting', desc: 'Grouping flat rows into Chart.js series' },
      { id: 'output-formats', title: 'Output Formats', url: '/output-formats', desc: 'JSON, CSV and NDJSON responses' },
    ],
  },
  {
    group: 'Reference',
    items: [
      { id: 'errors', title: 'Errors', url: '/errors', desc: 'Status codes and error body shape' },
      { id: 'faq', title: 'FAQ & Operational Notes', url: '/faq', desc: 'Update frequency, uptime, rate limits' },
    ],
  },
];

const API_ORIGIN = 'https://api.currency.uwuapps.org';

/* Finer-grained search entries — specific params/concepts that live inside
   a page rather than being the page itself. Keeps Ctrl+K useful for
   "what does ?group= do" style queries without a full-text index. */
const SEARCH_EXTRA = [
  { title: 'base parameter', url: '/rates-latest', section: 'Latest Rates', snippet: 'Change the base currency, e.g. ?base=USD' },
  { title: 'quotes parameter', url: '/rates-latest', section: 'Latest Rates', snippet: 'Filter to specific target currencies' },
  { title: 'date parameter', url: '/rates-historical', section: 'Historical Rates', snippet: 'Fetch rates for one past date, e.g. ?date=1999-01-04' },
  { title: 'from / to parameters', url: '/rates-timeseries', section: 'Time Series', snippet: 'Bound a date range for time series data' },
  { title: 'group parameter', url: '/rates-timeseries', section: 'Time Series', snippet: 'Downsample a time series by week or month' },
  { title: 'providers parameter', url: '/providers', section: 'Providers', snippet: 'Pin results to one data source, e.g. ?providers=ECB' },
  { title: 'expand=providers', url: '/providers', section: 'Providers', snippet: 'See which providers contributed to a blended rate' },
  { title: 'scope=all', url: '/currencies', section: 'Currencies', snippet: 'Include legacy/retired currencies in the list' },
  { title: 'CSV output', url: '/output-formats', section: 'Output Formats', snippet: 'Append .csv or send Accept: text/csv' },
  { title: 'NDJSON output', url: '/output-formats', section: 'Output Formats', snippet: 'Newline-delimited JSON for large time series' },
  { title: 'Chart.js example', url: '/charting', section: 'Charting', snippet: 'Group flat rows into per-currency series' },
  { title: 'Rate limits', url: '/faq', section: 'FAQ', snippet: 'No request quota — self-hosted, no API key' },
  { title: 'CORS', url: '/faq', section: 'FAQ', snippet: 'Calling the API directly from browser JavaScript' },
  { title: 'Update frequency', url: '/faq', section: 'FAQ', snippet: 'Rates refresh roughly daily around 16:00 CET' },
  { title: '400 Bad Request', url: '/errors', section: 'Errors', snippet: 'Invalid parameter or malformed request' },
  { title: '404 Not Found', url: '/errors', section: 'Errors', snippet: 'Currency, rate, or resource not found' },
  { title: '422 Unprocessable', url: '/errors', section: 'Errors', snippet: 'Request understood but cannot be processed' },
];
