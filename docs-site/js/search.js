/* ─── Ctrl+K / "/" search modal ─── */

function buildSearchIndex() {
  const pageEntries = NAV.flatMap(section =>
    section.items.map(item => ({
      title: item.title,
      url: item.url,
      section: section.group,
      snippet: item.desc || '',
      weight: 2,
    }))
  );
  const extraEntries = (typeof SEARCH_EXTRA !== 'undefined' ? SEARCH_EXTRA : [])
    .map(e => ({ ...e, weight: 1 }));
  return [...pageEntries, ...extraEntries];
}

function scoreEntry(entry, query) {
  const q = query.toLowerCase();
  const title = entry.title.toLowerCase();
  const snippet = (entry.snippet || '').toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.includes(q)) return 60 + entry.weight;
  if (snippet.includes(q)) return 30 + entry.weight;
  return 0;
}

function initSearch() {
  const modal = document.getElementById('search-modal');
  const openBtns = document.querySelectorAll('[data-search-open]');
  const closeBtn = document.getElementById('close-search-modal');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!modal || !input || !results) return;

  const index = buildSearchIndex();
  let activeIndex = -1;

  function render(items) {
    results.innerHTML = '';
    if (!items.length) {
      results.innerHTML = `<li class="search-empty">No results. Try a different term.</li>`;
      return;
    }
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="${item.url}" class="search-result${i === activeIndex ? ' active' : ''}" data-index="${i}">
          <span class="search-result__section">${item.section}</span>
          <span class="search-result__title">${item.title}</span>
          ${item.snippet ? `<span class="search-result__snippet">${item.snippet}</span>` : ''}
        </a>
      `;
      results.appendChild(li);
    });
  }

  function runQuery() {
    const q = input.value.trim();
    activeIndex = -1;
    if (!q) {
      render(index.slice(0, 8));
      return;
    }
    const scored = index
      .map(entry => ({ entry, score: scoreEntry(entry, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.entry)
      .slice(0, 12);
    render(scored);
  }

  function open() {
    modal.classList.remove('hidden');
    input.value = '';
    runQuery();
    setTimeout(() => input.focus(), 0);
  }
  function close() {
    modal.classList.add('hidden');
  }

  openBtns.forEach(btn => btn.addEventListener('click', open));
  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });

  input.addEventListener('input', runQuery);
  input.addEventListener('keydown', e => {
    const links = results.querySelectorAll('.search-result');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, links.length - 1);
      links.forEach((l, i) => l.classList.toggle('active', i === activeIndex));
      links[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      links.forEach((l, i) => l.classList.toggle('active', i === activeIndex));
      links[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      const target = links[activeIndex] || links[0];
      if (target) { e.preventDefault(); window.location.href = target.getAttribute('href'); }
    }
  });

  document.addEventListener('keydown', e => {
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping)) {
      e.preventDefault();
      modal.classList.contains('hidden') ? open() : close();
    } else if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      close();
    }
  });
}

document.addEventListener('DOMContentLoaded', initSearch);
