/* ─── Theme System ─── */

const THEMES = [
  { id: 'classic',     name: 'Classic',                  bg: '#ccffcc', accent: '#99ff99', accentDark: '#55cc55', ring: '#3aa165', link: '#167a45' },
  { id: 'notgreen1',   name: 'Not green 1',              bg: '#ffcccc', accent: '#ff9999', accentDark: '#ee5555', ring: '#cc4444', link: '#8b1a1a' },
  { id: 'notgreen2',   name: 'Not green 2',              bg: '#ccccff', accent: '#9999ff', accentDark: '#5555ee', ring: '#4444cc', link: '#1a1a8b' },
  { id: 'notgreen3',   name: 'Not green 3',              bg: '#ffffcc', accent: '#ffff88', accentDark: '#cccc33', ring: '#8b8b00', link: '#5a5a00' },
  { id: 'notgreen4',   name: 'Not green 4',              bg: '#ffccff', accent: '#ff99ff', accentDark: '#dd44dd', ring: '#aa00aa', link: '#6a006a' },
  { id: 'notgreen5',   name: 'Not green 5',              bg: '#ccffff', accent: '#88ffff', accentDark: '#33cccc', ring: '#007a7a', link: '#005a5a' },
  { id: 'white',       name: 'Really really light green', bg: '#ffffff', accent: '#ccffcc', accentDark: '#88cc88', ring: '#3aa165', link: '#167a45' },
];

function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dark', theme.accentDark);
  root.style.setProperty('--ring', theme.ring);
  root.style.setProperty('--link', theme.link);
  localStorage.setItem('uwuconvert.theme', theme.id);

  // Update active swatch in picker
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme.id);
  });
}

function buildThemePicker() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  THEMES.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = 'theme-swatch';
    btn.dataset.theme = theme.id;
    btn.setAttribute('aria-label', `Apply ${theme.name} theme`);
    btn.innerHTML = `
      <span class="swatch-dot" style="background:${theme.bg};"></span>
      <span class="swatch-name">${theme.name}</span>
    `;
    btn.addEventListener('click', () => {
      applyTheme(theme.id);
    });
    grid.appendChild(btn);
  });
}

function initTheme() {
  buildThemePicker();
  const saved = localStorage.getItem('uwuconvert.theme') || 'classic';
  applyTheme(saved);
}

/* ─── Theme Modal ─── */

function attachThemeModal() {
  const modal = document.getElementById('theme-modal');
  const openBtn = document.getElementById('theme-toggle');
  const closeBtn = document.getElementById('close-theme-modal');
  if (!modal || !openBtn || !closeBtn) return;

  function open() {
    modal.classList.remove('hidden');
    closeBtn.focus();
  }

  function close() {
    modal.classList.add('hidden');
    openBtn.focus();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}

/* ─── Currency Converter ─── */

const API_BASE = '/api';

const els = {
  amount:      document.getElementById('amount'),
  from:        document.getElementById('from'),
  to:          document.getElementById('to'),
  clearFrom:   document.getElementById('clear-from'),
  clearTo:     document.getElementById('clear-to'),
  swap:        document.getElementById('swap'),
  convert:     document.getElementById('convert'),
  invert:      document.getElementById('invert'),
  lastUpdated: document.getElementById('last-updated'),
  refresh:     document.getElementById('refresh'),
  fromAmount:  document.getElementById('from-amount'),
  fromCode:    document.getElementById('from-code'),
  toAmount:    document.getElementById('to-amount'),
  toCode:      document.getElementById('to-code'),
  rateLine:    document.getElementById('rate-line'),
  datalist:    document.getElementById('currency-list'),
  toastTpl:    document.getElementById('toast'),
  share:       document.getElementById('share'),
  resultCard:  document.querySelector('.result'),
  rangePicker: document.getElementById('range-picker'),
  chips:       document.getElementById('currency-chips'),
  addCurrency: document.getElementById('add-currency'),
  chart:       document.getElementById('rate-chart'),
  graphStatus: document.getElementById('graph-status'),
};

let currencies = {};
let currencyMeta = {};
let lastRate = null;

const nf = new Intl.NumberFormat(navigator.language || 'en-SG', {
  maximumFractionDigits: 6,
});

function showToast(msg) {
  const t = els.toastTpl.content.cloneNode(true);
  const node = t.querySelector('.toast');
  node.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => node.remove(), 2700);
}

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function optionLabel(code, name) {
  return `${code} — ${name}`;
}

function setUpdatedText(dateStr) {
  if (!dateStr) { els.lastUpdated.textContent = ''; return; }
  // dateStr is a plain "YYYY-MM-DD" calendar date, not an instant — format it
  // in UTC so it always matches the API's date exactly, regardless of the
  // viewer's local timezone (formatting in local time can shift it by a day).
  const d = new Date(`${dateStr}T00:00:00Z`);
  const fmt = new Intl.DateTimeFormat(navigator.language || 'en-SG', {
    year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC',
  }).format(d);
  els.lastUpdated.textContent = `Rates as of ${fmt}`;
}

function populateDatalist() {
  const frag = document.createDocumentFragment();
  Object.entries(currencies).forEach(([code, name]) => {
    const opt = document.createElement('option');
    opt.value = optionLabel(code, name);
    opt.dataset.code = code;
    frag.appendChild(opt);
  });
  els.datalist.innerHTML = '';
  els.datalist.appendChild(frag);
}

function codeFromInput(value) {
  if (!value) return '';
  const trimmed = value.trim();
  const match = trimmed.match(/\b([A-Z]{3})\b/);
  if (match) return match[1];
  const lower = trimmed.toLowerCase();
  const found = Object.entries(currencies).find(([code, name]) =>
    code.toLowerCase() === lower || name.toLowerCase() === lower
  );
  return found ? found[0] : '';
}

async function loadCurrencies() {
  const raw = await fetchJSON(`${API_BASE}/currencies`);
  currencies = {};
  currencyMeta = {};
  raw.forEach((c) => {
    currencies[c.iso_code] = c.name;
    currencyMeta[c.iso_code] = { startDate: c.start_date, symbol: c.symbol };
  });
  populateDatalist();
  if (!els.from.value) els.from.value = optionLabel('SGD', currencies['SGD'] || 'Singapore Dollar');
  if (!els.to.value)   els.to.value   = optionLabel('MYR', currencies['MYR'] || 'Malaysian Ringgit');
}

async function convert() {
  const amount   = parseFloat(els.amount.value || '0');
  const fromCode = codeFromInput(els.from.value);
  const toCode   = codeFromInput(els.to.value);

  if (!amount || amount < 0) { showToast('Enter a valid amount'); return; }
  if (!fromCode || !toCode)  { showToast('Choose both currencies'); return; }

  if (fromCode === toCode) {
    lastRate = 1;
    els.fromAmount.textContent = nf.format(amount);
    els.fromCode.textContent   = fromCode;
    els.toAmount.textContent   = nf.format(amount);
    els.toCode.textContent     = toCode;
    els.rateLine.textContent   = `1 ${fromCode} = 1 ${toCode}`;
    setUpdatedText(new Date().toISOString().slice(0, 10));
    onCurrencyPairChanged();
    return;
  }

  els.convert.disabled     = true;
  els.convert.textContent  = 'Converting…';
  try {
    const data = await fetchJSON(`${API_BASE}/rates?base=${fromCode}`);
    const row  = data.find((r) => r.quote === toCode);

    if (!row) {
      showToast(`Rate not available for ${fromCode} → ${toCode}`);
      return;
    }

    lastRate = row.rate;
    const out = amount * lastRate;
    setUpdatedText(row.date);
    els.fromAmount.textContent = nf.format(amount);
    els.fromCode.textContent   = fromCode;
    els.toAmount.textContent   = nf.format(out);
    els.toCode.textContent     = toCode;
    els.rateLine.textContent   = `1 ${fromCode} = ${nf.format(lastRate)} ${toCode}`;
    onCurrencyPairChanged();
  } catch (err) {
    console.error(err);
    showToast('Failed to fetch rates. Try refresh.');
  } finally {
    els.convert.disabled    = false;
    els.convert.textContent = 'Convert';
  }
}

function swapCurrencies() {
  const a = els.from.value;
  els.from.value = els.to.value;
  els.to.value = a;
  convert();
}

function invertRate() {
  if (!lastRate) { showToast('Convert first'); return; }
  const fromCode = codeFromInput(els.from.value);
  const toCode   = codeFromInput(els.to.value);
  const inv = 1 / lastRate;
  els.rateLine.textContent = `1 ${toCode} = ${nf.format(inv)} ${fromCode}`;
}

async function captureResultCard() {
  els.resultCard.classList.add('share-theme');
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = await html2canvas(els.resultCard, { backgroundColor: null, scale });
  els.resultCard.classList.remove('share-theme');
  return new Promise(resolve => { canvas.toBlob(blob => resolve(blob), 'image/png'); });
}

function buildShareText() {
  const valueLine = `${els.fromAmount.textContent} ${els.fromCode.textContent} = ${els.toAmount.textContent} ${els.toCode.textContent}`;
  const rateLine  = els.rateLine.textContent;
  return [valueLine, rateLine].join('\n');
}

async function shareConversion() {
  if (!els.fromAmount.textContent || !els.toAmount.textContent) {
    showToast('Convert first'); return;
  }
  const shareText = buildShareText();
  try {
    const blob  = await captureResultCard();
    const files = blob ? [new File([blob], 'conversion.png', { type: 'image/png' })] : [];

    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ title: 'Currency Converter', text: shareText, files });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: 'Currency Converter', text: shareText });
      if (blob) { downloadBlob(blob); showToast('Saved conversion.png'); }
      return;
    }
    if (blob) downloadBlob(blob);
    await navigator.clipboard?.writeText(shareText);
    showToast('Text copied; image downloaded.');
  } catch (err) {
    console.error(err);
    showToast('Sharing failed.');
  }
}

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversion.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ─── Share Menu ─── */

const SHARE_SVG = {
  device: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`,
  telegram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>`,
  twitter: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`,
  facebook: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
  save: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
};

function createShareMenu() {
  const menu = document.createElement('div');
  menu.className = 'share-menu hidden';

  const items = [
    { action: 'device',   label: 'Device',    icon: SHARE_SVG.device   },
    { action: 'telegram', label: 'Telegram',   icon: SHARE_SVG.telegram  },
    { action: 'twitter',  label: 'Twitter / X', icon: SHARE_SVG.twitter  },
    { action: 'whatsapp', label: 'WhatsApp',   icon: SHARE_SVG.whatsapp  },
    { action: 'facebook', label: 'Facebook',   icon: SHARE_SVG.facebook  },
    { action: 'save',     label: 'Save as Image', icon: SHARE_SVG.save  },
  ];

  menu.innerHTML = items.map(({ action, label, icon }) => `
    <div class="share-menu__item" data-action="${action}" role="button" tabindex="0">
      ${icon}
      <span class="share-menu__text">${label}</span>
    </div>
  `).join('');

  document.querySelector('.card__footer').appendChild(menu);

  let hideT;
  const show = () => { clearTimeout(hideT); menu.classList.remove('hidden'); };
  const hide = () => { hideT = setTimeout(() => menu.classList.add('hidden'), 150); };

  els.share.addEventListener('mouseenter', show);
  els.share.addEventListener('focus', show);
  els.share.addEventListener('mouseleave', hide);
  els.share.addEventListener('blur', hide);
  menu.addEventListener('mouseenter', show);
  menu.addEventListener('mouseleave', hide);

  menu.addEventListener('click', async e => {
    const item = e.target.closest('.share-menu__item');
    if (!item) return;

    if (!els.fromAmount.textContent || !els.toAmount.textContent) {
      showToast('Convert first'); return;
    }

    const action   = item.dataset.action;
    const url      = window.location.href;
    const text     = buildShareText();
    const encUrl   = encodeURIComponent(url);
    const encText  = encodeURIComponent(text);

    switch (action) {
      case 'device':
        await shareConversion();
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encUrl}&text=${encText}`, '_blank', 'noopener');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encText}&url=${encUrl}`, '_blank', 'noopener');
        break;
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encText}%0A${encUrl}`, '_blank', 'noopener');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`, '_blank', 'noopener');
        break;
      case 'save':
        try {
          const blob = await captureResultCard();
          if (blob) { downloadBlob(blob); showToast('Saved conversion.png'); }
          else showToast('Could not generate image.');
        } catch (err) {
          console.error(err); showToast('Save failed.');
        }
        break;
    }
    hide();
  });
}

/* ─── Historical Graph ─── */

// Fixed-order categorical palette (light-mode steps; the site has no dark
// surface — cards are always a translucent-white glass panel — so a single
// set is enough). Order is the CVD-safety mechanism: never cycle/reassign.
const CHART_COLORS = ['#2a78d6', '#008300', '#e87ba4', '#eda100', '#1baf7a', '#eb6834', '#4a3aa7', '#e34948'];
const MAX_GRAPH_QUOTES = 6;
const FALLBACK_START_DATE = '1999-01-04';

const graphState = { base: '', quotes: [], range: '1m' };
let rateChart = null;

function colorFor(index) {
  return CHART_COLORS[index % CHART_COLORS.length];
}

function computeFromDate(range) {
  const today = new Date();
  const d = new Date(today);
  switch (range) {
    case '5d': d.setDate(d.getDate() - 5); break;
    case '1w': d.setDate(d.getDate() - 7); break;
    case '1m': d.setMonth(d.getMonth() - 1); break;
    case '1y': d.setFullYear(d.getFullYear() - 1); break;
    case '5y': d.setFullYear(d.getFullYear() - 5); break;
    case 'max': {
      const starts = [graphState.base, ...graphState.quotes]
        .map((c) => currencyMeta[c] && currencyMeta[c].startDate)
        .filter(Boolean);
      return starts.length ? starts.reduce((a, b) => (a > b ? a : b)) : FALLBACK_START_DATE;
    }
    default: d.setMonth(d.getMonth() - 1);
  }
  return d.toISOString().slice(0, 10);
}

function groupFor(range) {
  if (range === '1y') return 'week';
  if (range === '5y' || range === 'max') return 'month';
  return '';
}

function renderChips() {
  els.chips.innerHTML = '';
  graphState.quotes.forEach((code, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `
      <span class="chip__swatch" style="background:${colorFor(i)};"></span>
      <span>${code}</span>
    `;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip__remove';
    removeBtn.setAttribute('aria-label', `Remove ${code} from graph`);
    removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    removeBtn.addEventListener('click', () => removeGraphQuote(code));
    chip.appendChild(removeBtn);
    els.chips.appendChild(chip);
  });
}

function removeGraphQuote(code) {
  if (graphState.quotes.length <= 1) { showToast('Keep at least one currency'); return; }
  graphState.quotes = graphState.quotes.filter((c) => c !== code);
  renderChips();
  loadGraph();
}

function addGraphQuote(code) {
  if (!code || code === graphState.base || graphState.quotes.includes(code)) return;
  if (graphState.quotes.length >= MAX_GRAPH_QUOTES) { showToast(`Up to ${MAX_GRAPH_QUOTES} currencies at once`); return; }
  graphState.quotes.push(code);
  renderChips();
  loadGraph();
}

// Called whenever the From/To pickers settle on a new pair — resets the
// graph to track that pair; manual add/remove customizes it from there
// until the next currency change.
function onCurrencyPairChanged() {
  const fromCode = codeFromInput(els.from.value);
  const toCode   = codeFromInput(els.to.value);
  if (!fromCode || !toCode || fromCode === graphState.base && graphState.quotes[0] === toCode) return;
  graphState.base = fromCode;
  graphState.quotes = [toCode];
  renderChips();
  loadGraph();
}

async function loadGraph() {
  if (!graphState.base || !graphState.quotes.length || typeof Chart === 'undefined') return;
  els.graphStatus.textContent = 'Loading…';
  try {
    const from = computeFromDate(graphState.range);
    const group = groupFor(graphState.range);
    const url = `${API_BASE}/history?base=${graphState.base}&quotes=${graphState.quotes.join(',')}&from=${from}${group ? `&group=${group}` : ''}`;
    const rows = await fetchJSON(url);

    const series = {};
    const dateSet = new Set();
    rows.forEach((row) => {
      series[row.quote] ??= {};
      series[row.quote][row.date] = row.rate;
      dateSet.add(row.date);
    });
    const labels = [...dateSet].sort();
    const indexed = graphState.quotes.filter((q) => series[q]).length > 1;

    // With 2+ quotes selected, absolute rates can sit on wildly different
    // scales (e.g. JPY ~150 vs MYR ~4) — a shared linear axis would flatten
    // the smaller series to invisibility. Index each series to 100 at its
    // first visible point so multiple currencies stay comparable on one axis.
    const datasets = graphState.quotes
      .filter((q) => series[q])
      .map((q, i) => {
        const raw = labels.map((d) => series[q][d] ?? null);
        const base = raw.find((v) => v != null);
        const data = indexed && base ? raw.map((v) => (v == null ? null : (v / base) * 100)) : raw;
        return {
          label: `${graphState.base}/${q}`,
          data,
          borderColor: colorFor(i),
          backgroundColor: colorFor(i),
          spanGaps: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        };
      });

    if (rateChart) rateChart.destroy();
    rateChart = new Chart(els.chart, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(0,0,0,0.08)' },
            title: { display: indexed, text: 'Indexed (100 = start of range)' },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: {
            callbacks: indexed
              ? { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y == null ? '—' : ctx.parsed.y.toFixed(2)}` }
              : undefined,
          },
        },
      },
    });
    els.graphStatus.textContent = indexed ? 'Comparing 2+ currencies indexes each to 100 at the start of the range.' : '';
  } catch (err) {
    console.error(err);
    els.graphStatus.textContent = 'Could not load historical rates.';
  }
}

function attachGraphEvents() {
  els.rangePicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.range-picker__btn');
    if (!btn) return;
    els.rangePicker.querySelectorAll('.range-picker__btn').forEach((b) => b.classList.toggle('active', b === btn));
    graphState.range = btn.dataset.range;
    loadGraph();
  });

  els.addCurrency.addEventListener('change', () => {
    const code = codeFromInput(els.addCurrency.value);
    els.addCurrency.value = '';
    if (code && currencies[code]) addGraphQuote(code);
  });
}

/* ─── State Persistence ─── */

function saveState() {
  localStorage.setItem('uwuconvert.state', JSON.stringify({
    amount: els.amount.value,
    from:   els.from.value,
    to:     els.to.value,
  }));
}

function loadState() {
  const raw = localStorage.getItem('uwuconvert.state');
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    if (s.amount) els.amount.value = s.amount;
    if (s.from)   els.from.value   = s.from;
    if (s.to)     els.to.value     = s.to;
  } catch (e) {
    console.error('Failed to parse saved state', e);
  }
}

/* ─── Share Target (recognise shared/highlighted text like "50 USD") ─── */

const SHARE_SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR' };

function parseSharedText(text) {
  if (!text) return null;

  const codeRe = /\b(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3})\b|\b([A-Za-z]{3})\s*(\d[\d,]*(?:\.\d+)?)\b/;
  const codeMatch = text.match(codeRe);
  if (codeMatch) {
    const amount = codeMatch[1] || codeMatch[4];
    const code = (codeMatch[2] || codeMatch[3] || '').toUpperCase();
    if (currencies[code]) return { amount: parseFloat(amount.replace(/,/g, '')), code };
  }

  const symRe = /([$€£¥₹])\s*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s*([$€£¥₹])/;
  const symMatch = text.match(symRe);
  if (symMatch) {
    const amount = symMatch[2] || symMatch[3];
    const code = SHARE_SYMBOLS[symMatch[1] || symMatch[4]];
    if (code && currencies[code]) return { amount: parseFloat(amount.replace(/,/g, '')), code };
  }

  return null;
}

function applySharedText() {
  const params = new URLSearchParams(location.search);
  const text = params.get('text') || params.get('title') || params.get('url') || '';
  history.replaceState(null, '', location.pathname);
  if (!text) return false;

  const parsed = parseSharedText(text);
  if (!parsed) return false;

  els.amount.value = parsed.amount;
  els.from.value = optionLabel(parsed.code, currencies[parsed.code]);
  saveState();
  return true;
}

/* ─── Event Wiring ─── */

function attachEvents() {
  els.convert.addEventListener('click', convert);
  els.swap.addEventListener('click', swapCurrencies);
  els.invert.addEventListener('click', invertRate);
  els.refresh.addEventListener('click', () => { showToast('Refreshing…'); convert(); });

  ['from', 'to'].forEach(id => {
    const input = els[id];
    input.addEventListener('change', () => {
      const code = codeFromInput(input.value);
      if (code && currencies[code]) input.value = optionLabel(code, currencies[code]);
      saveState();
      convert();
    });
  });

  els.amount.addEventListener('input', () => {
    clearTimeout(els.amount.__t);
    els.amount.__t = setTimeout(() => { saveState(); convert(); }, 250);
  });

  els.clearFrom.addEventListener('click', () => { els.from.value = ''; els.from.focus(); saveState(); });
  els.clearTo.addEventListener('click',   () => { els.to.value   = ''; els.to.focus();   saveState(); });

  [els.amount, els.from, els.to].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') convert(); })
  );

  createShareMenu();
  attachGraphEvents();
}

/* ─── Service Worker ─── */

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('SW registration failed:', err));
  }
}

/* ─── Init ─── */

(async function init() {
  initTheme();
  attachThemeModal();
  attachEvents();
  registerSW();
  try {
    await loadCurrencies();
    loadState();
    if (applySharedText()) showToast('Detected shared amount');
    await convert();
  } catch (err) {
    console.error(err);
    showToast('Could not load currencies.');
  }
})();
