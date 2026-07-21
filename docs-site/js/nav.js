/* ─── Sidebar, mobile nav toggle, and on-page table of contents ─── */

const METHOD_CLASS = {
  GET: 'badge--get',
  POST: 'badge--post',
};

function buildSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;
  const current = window.PAGE_ID || 'index';

  nav.innerHTML = NAV.map(section => `
    <div class="side-group">
      <h3 class="side-group__title">${section.group}</h3>
      <ul class="side-list">
        ${section.items.map(item => `
          <li>
            <a href="${item.url}" class="side-link${item.id === current ? ' active' : ''}"${item.id === current ? ' aria-current="page"' : ''}>
              <span>${item.title}</span>
              ${item.method ? `<span class="badge ${METHOD_CLASS[item.method] || ''}">${item.method}</span>` : ''}
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

/* ─── Sidebar hamburger ───
   One button, two meanings depending on viewport: on desktop it collapses
   an always-visible sidebar to free up width for the content column (and
   remembers that choice); on mobile the sidebar starts hidden and the same
   button opens it as an overlay with a scrim. Both use the same CSS class,
   body.sidebar-toggled; see docs.css, which flips what the class means
   at the 900px breakpoint. */
const SIDEBAR_STORAGE_KEY = 'uwudocs.sidebarCollapsed';

function isMobileViewport() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function attachSidebarToggle() {
  const toggle = document.getElementById('menu-toggle');
  const scrim = document.getElementById('sidebar-scrim');
  const sidebar = document.getElementById('sidebar');
  if (!toggle) return;

  function setToggled(on) {
    document.body.classList.toggle('sidebar-toggled', on);
    const visible = isMobileViewport() ? on : !on;
    toggle.setAttribute('aria-expanded', String(visible));
    if (!isMobileViewport()) localStorage.setItem(SIDEBAR_STORAGE_KEY, on ? '1' : '0');
  }

  if (!isMobileViewport() && localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1') {
    setToggled(true);
  } else {
    setToggled(document.body.classList.contains('sidebar-toggled'));
  }

  toggle.addEventListener('click', () => {
    setToggled(!document.body.classList.contains('sidebar-toggled'));
  });

  scrim?.addEventListener('click', () => { if (isMobileViewport()) setToggled(false); });

  sidebar?.addEventListener('click', e => {
    if (isMobileViewport() && e.target.closest('.side-link')) setToggled(false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isMobileViewport() && document.body.classList.contains('sidebar-toggled')) {
      setToggled(false);
    }
  });
}

/* Builds the "On this page" rail from h2/h3 headings inside #content. */
function buildTOC() {
  const content = document.getElementById('content');
  const tocList = document.getElementById('toc-list');
  const tocNav = document.getElementById('toc');
  if (!content || !tocList || !tocNav) return;

  const headings = content.querySelectorAll('h2[id], h3[id]');
  if (!headings.length) { tocNav.classList.add('hidden'); return; }

  tocList.innerHTML = Array.from(headings).map(h => `
    <li class="toc-item toc-item--${h.tagName.toLowerCase()}">
      <a href="#${h.id}">${h.textContent}</a>
    </li>
  `).join('');

  const links = tocList.querySelectorAll('a');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = tocList.querySelector(`a[href="#${entry.target.id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { rootMargin: '-80px 0px -70% 0px' });

  headings.forEach(h => observer.observe(h));
}

/* Copy-to-clipboard on every <pre> code block. */
function attachCodeCopy() {
  document.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.code-copy')) return;
    const btn = document.createElement('button');
    btn.className = 'code-copy';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    btn.addEventListener('click', async () => {
      const text = pre.innerText.replace(/\n$/, '');
      try {
        await navigator.clipboard.writeText(text);
        btn.classList.add('copied');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
        }, 1600);
      } catch (err) {
        console.error('Copy failed', err);
      }
    });
    pre.appendChild(btn);
  });
}

/* Builds prev/next footer links from NAV's flattened item order. */
function buildPager() {
  const pager = document.getElementById('pager');
  if (!pager) return;
  const flat = NAV.flatMap(s => s.items);
  const idx = flat.findIndex(i => i.id === window.PAGE_ID);
  if (idx === -1) return;
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  pager.innerHTML = `
    ${prev ? `<a class="pager__link pager__link--prev" href="${prev.url}">
      <span class="pager__label">Previous</span>
      <span class="pager__title">${prev.title}</span>
    </a>` : '<span></span>'}
    ${next ? `<a class="pager__link pager__link--next" href="${next.url}">
      <span class="pager__label">Next</span>
      <span class="pager__title">${next.title}</span>
    </a>` : '<span></span>'}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  attachSidebarToggle();
  buildTOC();
  attachCodeCopy();
  buildPager();
});
