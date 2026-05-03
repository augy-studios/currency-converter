const API_BASE = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';

const THEMES = [
  { id: 'classic',     label: 'Classic',                  metaColor: '#ccffcc' },
  { id: 'not-green-1', label: 'Not green 1',              metaColor: '#ffcccc' },
  { id: 'not-green-2', label: 'Not green 2',              metaColor: '#ccccff' },
  { id: 'not-green-3', label: 'Not green 3',              metaColor: '#ffffcc' },
  { id: 'not-green-4', label: 'Not green 4',              metaColor: '#ffccff' },
  { id: 'not-green-5', label: 'Not green 5',              metaColor: '#ccffff' },
  { id: 'really-white',label: 'Really really light green',metaColor: '#f8fff8' },
];

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
  themeBtn:    document.getElementById('theme-btn'),
  themeModal:  document.getElementById('theme-modal'),
  themeClose:  document.getElementById('theme-modal-close'),
  themeBackdrop: document.getElementById('theme-modal-backdrop'),
  metaThemeColor: document.getElementById('meta-theme-color'),
};

let currencies = {};
let lastRate = null;

const nf = new Intl.NumberFormat(navigator.language || 'en-SG', {
  maximumFractionDigits: 6,
});

// ── Theme ──────────────────────────────────────────────────────

function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  document.documentElement.dataset.theme = theme.id;
  if (els.metaThemeColor) els.metaThemeColor.content = theme.metaColor;
  localStorage.setItem('uwuconvert.Theme', theme.id);
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme.id);
  });
}

function openThemeModal() {
  els.themeModal.setAttribute('aria-hidden', 'false');
}

function closeThemeModal() {
  els.themeModal.setAttribute('aria-hidden', 'true');
}

function loadTheme() {
  const saved = localStorage.getItem('uwuconvert.Theme') || 'classic';
  applyTheme(saved);
}

// ── Toasts ────────────────────────────────────────────────────

function showToast(msg) {
  const t = els.toastTpl.content.cloneNode(true);
  const node = t.querySelector('.toast');
  node.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => node.remove(), 2600);
}

// ── Data fetching ─────────────────────────────────────────────

async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Currency list ─────────────────────────────────────────────

function optionLabel(code, name) {
  return `${code} — ${name}`;
}

function setUpdatedText(dateStr) {
  if (!dateStr) { els.lastUpdated.textContent = ''; return; }
  const d = new Date(dateStr);
  const fmt = new Intl.DateTimeFormat(navigator.language || 'en-SG', {
    year: 'numeric', month: 'short', day: '2-digit',
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
  const found = Object.entries(currencies).find(
    ([code, name]) => code.toLowerCase() === lower || name.toLowerCase() === lower,
  );
  return found ? found[0] : '';
}

async function loadCurrencies() {
  const raw = await fetchJSON(`${API_BASE}/currencies.json`);
  currencies = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k.toUpperCase(), v]),
  );
  populateDatalist();
  if (!els.from.value) els.from.value = optionLabel('SGD', currencies['SGD'] || 'Singapore Dollar');
  if (!els.to.value)   els.to.value   = optionLabel('MYR', currencies['MYR'] || 'Malaysian Ringgit');
}

// ── Conversion ────────────────────────────────────────────────

async function convert() {
  const amount = parseFloat(els.amount.value || '0');
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
    return;
  }

  els.convert.disabled     = true;
  els.convert.textContent  = 'Converting…';
  try {
    const base = fromCode.toLowerCase();
    const data = await fetchJSON(`${API_BASE}/currencies/${base}.json`);
    const rates = data[base];
    const date  = data.date;
    const target = toCode.toLowerCase();
    const unit   = rates[target];

    if (typeof unit !== 'number') {
      showToast(`Rate not available for ${fromCode} → ${toCode}`);
      return;
    }

    lastRate = unit;
    const out = amount * unit;

    setUpdatedText(date);
    els.fromAmount.textContent = nf.format(amount);
    els.fromCode.textContent   = fromCode;
    els.toAmount.textContent   = nf.format(out);
    els.toCode.textContent     = toCode;
    els.rateLine.textContent   = `1 ${fromCode} = ${nf.format(lastRate)} ${toCode}`;
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

// ── Screenshot / share helpers ────────────────────────────────

async function captureResultCard() {
  els.resultCard.classList.add('share-theme');
  const scale  = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = await html2canvas(els.resultCard, { backgroundColor: null, scale });
  els.resultCard.classList.remove('share-theme');
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}

function buildShareText() {
  const valueLine = `${els.fromAmount.textContent} ${els.fromCode.textContent} = ${els.toAmount.textContent} ${els.toCode.textContent}`;
  const rateLine  = els.rateLine.textContent;
  return [valueLine, rateLine].join('\n');
}

async function shareConversion() {
  if (!els.fromAmount.textContent || !els.toAmount.textContent) {
    showToast('Convert first');
    return;
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
      if (blob) downloadBlob(blob, 'conversion.png', 'Saved conversion.png');
      return;
    }

    if (blob) downloadBlob(blob, 'conversion.png');
    await navigator.clipboard?.writeText(shareText);
    showToast('Text copied; image downloaded.');
  } catch (err) {
    console.error(err);
    showToast('Sharing failed.');
  }
}

function downloadBlob(blob, filename, toastMsg) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (toastMsg) showToast(toastMsg);
}

// ── Share menu ────────────────────────────────────────────────

function createShareMenu() {
  const menu = document.createElement('div');
  menu.className = 'share-menu hidden';
  menu.innerHTML = `
    <div class="share-menu__item" data-action="device">
      <i class="fa-solid fa-mobile-screen"></i>
      <span class="share-menu__text">Device</span>
    </div>
    <div class="share-menu__item" data-action="telegram">
      <i class="fa-brands fa-telegram"></i>
      <span class="share-menu__text">Telegram</span>
    </div>
    <div class="share-menu__item" data-action="twitter">
      <i class="fa-brands fa-x-twitter"></i>
      <span class="share-menu__text">Twitter/X</span>
    </div>
    <div class="share-menu__item" data-action="whatsapp">
      <i class="fa-brands fa-whatsapp"></i>
      <span class="share-menu__text">WhatsApp</span>
    </div>
    <div class="share-menu__item" data-action="facebook">
      <i class="fa-brands fa-facebook"></i>
      <span class="share-menu__text">Facebook</span>
    </div>
    <div class="share-menu__item" data-action="save">
      <i class="fa-regular fa-image"></i>
      <span class="share-menu__text">Save as Image</span>
    </div>
  `;
  document.querySelector('.card__footer').appendChild(menu);

  let hideT;
  const show = () => { clearTimeout(hideT); menu.classList.remove('hidden'); };
  const hide = () => { hideT = setTimeout(() => menu.classList.add('hidden'), 150); };

  els.share.addEventListener('mouseenter', show);
  els.share.addEventListener('focus',      show);
  els.share.addEventListener('mouseleave', hide);
  els.share.addEventListener('blur',       hide);
  menu.addEventListener('mouseenter', show);
  menu.addEventListener('mouseleave', hide);

  menu.addEventListener('click', async (e) => {
    const item = e.target.closest('.share-menu__item');
    if (!item) return;

    if (!els.fromAmount.textContent || !els.toAmount.textContent) {
      showToast('Convert first');
      return;
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
          if (blob) {
            downloadBlob(blob, 'conversion.png', 'Saved conversion.png');
          } else {
            showToast('Could not generate image.');
          }
        } catch (err) {
          console.error(err);
          showToast('Save failed.');
        }
        break;
    }
    hide();
  });
}

// ── State persistence ─────────────────────────────────────────

function saveState() {
  localStorage.setItem('uwuconvert.State', JSON.stringify({
    amount: els.amount.value,
    from:   els.from.value,
    to:     els.to.value,
  }));
}

function loadState() {
  const raw = localStorage.getItem('uwuconvert.State');
  if (!raw) return;
  try {
    const state = JSON.parse(raw);
    if (state.amount) els.amount.value = state.amount;
    if (state.from)   els.from.value   = state.from;
    if (state.to)     els.to.value     = state.to;
  } catch (e) {
    console.error('Failed to parse saved state', e);
  }
}

// ── Event wiring ──────────────────────────────────────────────

function attachEvents() {
  // Converter actions
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
    el.addEventListener('keydown', e => { if (e.key === 'Enter') convert(); }),
  );

  // Theme picker
  els.themeBtn.addEventListener('click', openThemeModal);
  els.themeClose.addEventListener('click', closeThemeModal);
  els.themeBackdrop.addEventListener('click', closeThemeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeThemeModal();
  });

  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      setTimeout(closeThemeModal, 180);
    });
  });

  createShareMenu();
}

// ── Init ──────────────────────────────────────────────────────

(async function init() {
  loadTheme();
  attachEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  try {
    await loadCurrencies();
    loadState();
    await convert();
  } catch (err) {
    console.error(err);
    showToast('Could not load currencies.');
  }
})();
