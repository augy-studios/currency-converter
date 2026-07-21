/* ─── "Try it" interactive API console ───
   Renders a live request builder for a <div class="try-it"> declared with
   data attributes, and calls the API directly from the browser, since this
   instance's Frankfurter deployment sends permissive CORS headers, so no
   serverless proxy is needed for read-only GET calls.

   Each entry in data-params can carry a "type" so the field renders as the
   right native control instead of a plain text box:
     - "date"           -> <input type="date">, so the browser's own picker opens
     - "currency"       -> <select> of every supported code, fetched once
     - "currency-multi" -> <select multiple>, for comma-separated params like quotes
     - "select"         -> <select> from a fixed "options" list (e.g. week/month)
     - (omitted)        -> plain text input, unchanged */

let currencyOptionsPromise = null;

function loadCurrencyOptions() {
  if (!currencyOptionsPromise) {
    currencyOptionsPromise = fetch(`${API_ORIGIN}/v2/currencies`, { cache: 'no-store' })
      .then(res => res.json())
      .then(rows => rows
        .map(c => ({ code: c.iso_code, name: c.name }))
        .sort((a, b) => a.code.localeCompare(b.code)))
      .catch(() => []);
  }
  return currencyOptionsPromise;
}

function fieldMarkup(p) {
  const required = p.required ? 'required' : '';
  if (p.type === 'date') {
    return `<input type="date" name="${p.name}" value="${p.default || ''}" ${required} />`;
  }
  if (p.type === 'select') {
    const opts = (p.options || []).map(o => {
      const value = typeof o === 'string' ? o : o.value;
      const label = typeof o === 'string' ? o : o.label;
      const selected = value === (p.default || '') ? 'selected' : '';
      return `<option value="${value}" ${selected}>${label}</option>`;
    }).join('');
    const blank = p.required ? '' : '<option value="">(any)</option>';
    return `<select name="${p.name}" ${required}>${blank}${opts}</select>`;
  }
  if (p.type === 'currency' || p.type === 'currency-multi') {
    const multiple = p.type === 'currency-multi' ? 'multiple size="5"' : '';
    return `<select name="${p.name}" ${multiple} ${required} data-currency-select="loading">
      <option value="">Loading currencies…</option>
    </select>`;
  }
  return `<input type="text" name="${p.name}" placeholder="${p.placeholder || ''}" value="${p.default || ''}" ${required} />`;
}

function hydrateCurrencySelect(select, p) {
  loadCurrencyOptions().then(currencies => {
    if (!currencies.length) {
      select.innerHTML = `<option value="${p.default || ''}">${p.default || 'unavailable'}</option>`;
      return;
    }
    const defaults = new Set((p.default || '').split(',').map(s => s.trim()).filter(Boolean));
    select.innerHTML = currencies.map(c =>
      `<option value="${c.code}" ${defaults.has(c.code) ? 'selected' : ''}>${c.code} - ${c.name}</option>`
    ).join('');
    select.removeAttribute('data-currency-select');
  });
}

function fieldValue(form, p) {
  const el = form.elements[p.name];
  if (!el) return '';
  if (p.type === 'currency-multi') {
    return [...el.selectedOptions].map(o => o.value).join(',');
  }
  return el.value;
}

function renderTryIt(el) {
  const method = el.dataset.method || 'GET';
  const path = el.dataset.path || '/v2/rates';
  let params = [];
  try { params = JSON.parse(el.dataset.params || '[]'); } catch (e) { params = []; }

  el.innerHTML = `
    <div class="tryit__head">
      <span class="badge badge--get">${method}</span>
      <code class="tryit__path">${path}</code>
    </div>
    <form class="tryit__form">
      ${params.map(p => `
        <label class="tryit__field">
          <span>${p.name}${p.required ? ' *' : ''}</span>
          ${fieldMarkup(p)}
          ${p.type === 'currency-multi' ? '<small class="tryit__hint">Ctrl/Cmd-click to select multiple</small>' : ''}
        </label>
      `).join('')}
      <button type="submit" class="btn btn--primary tryit__send">Send request</button>
    </form>
    <div class="tryit__result hidden">
      <div class="tryit__meta">
        <span class="tryit__status"></span>
        <span class="tryit__time"></span>
      </div>
      <pre class="tryit__response"><code></code></pre>
    </div>
  `;

  const form = el.querySelector('form');
  const resultBox = el.querySelector('.tryit__result');
  const statusEl = el.querySelector('.tryit__status');
  const timeEl = el.querySelector('.tryit__time');
  const codeEl = el.querySelector('.tryit__response code');
  const sendBtn = el.querySelector('.tryit__send');

  params
    .filter(p => p.type === 'currency' || p.type === 'currency-multi')
    .forEach(p => hydrateCurrencySelect(form.elements[p.name], p));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    let url = API_ORIGIN + path;
    const search = new URLSearchParams();
    for (const p of params) {
      const value = fieldValue(form, p);
      if (path.includes(`{${p.name}}`)) {
        url = url.replace(`{${p.name}}`, encodeURIComponent(value || ''));
      } else if (value) {
        search.set(p.name, value);
      }
    }
    const qs = search.toString();
    if (qs) url += `?${qs}`;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    resultBox.classList.remove('hidden');
    statusEl.textContent = '';
    timeEl.textContent = '';
    codeEl.textContent = '';

    const started = performance.now();
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const elapsed = Math.round(performance.now() - started);
      const text = await res.text();
      let pretty = text;
      try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* not JSON, e.g. CSV */ }

      statusEl.textContent = `${res.status} ${res.statusText}`;
      statusEl.className = `tryit__status ${res.ok ? 'tryit__status--ok' : 'tryit__status--err'}`;
      timeEl.textContent = `${elapsed} ms`;
      codeEl.textContent = pretty.length > 4000 ? pretty.slice(0, 4000) + '\n…(truncated)' : pretty;
    } catch (err) {
      statusEl.textContent = 'Request failed';
      statusEl.className = 'tryit__status tryit__status--err';
      codeEl.textContent = String(err);
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send request';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.try-it').forEach(renderTryIt);
});
