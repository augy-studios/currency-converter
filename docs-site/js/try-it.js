/* ─── "Try it" interactive API console ───
   Renders a live request builder for a <div class="try-it"> declared with
   data attributes, and calls the API directly from the browser, since this
   instance's Frankfurter deployment sends permissive CORS headers, so no
   serverless proxy is needed for read-only GET calls. */

function renderTryIt(el) {
  const method = el.dataset.method || 'GET';
  const path = el.dataset.path || '/v2/rates';
  let params = [];
  try { params = JSON.parse(el.dataset.params || '[]'); } catch (e) { params = []; }

  const formId = `tryit-${Math.random().toString(36).slice(2, 8)}`;

  el.innerHTML = `
    <div class="tryit__head">
      <span class="badge badge--get">${method}</span>
      <code class="tryit__path">${path}</code>
    </div>
    <form class="tryit__form" id="${formId}">
      ${params.map(p => `
        <label class="tryit__field">
          <span>${p.name}${p.required ? ' *' : ''}</span>
          <input type="text" name="${p.name}" placeholder="${p.placeholder || ''}" value="${p.default || ''}" ${p.required ? 'required' : ''} />
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

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = new FormData(form);
    let url = API_ORIGIN + path;
    const search = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (path.includes(`{${key}}`)) {
        url = url.replace(`{${key}}`, encodeURIComponent(value || ''));
      } else if (value) {
        search.set(key, value);
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
