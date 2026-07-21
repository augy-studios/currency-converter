/* ─── Theme System (shared across every docs page) ─── */

const THEMES = [
  { id: 'classic',   name: 'Classic',                    bg: '#ccffcc', accent: '#99ff99', accentDark: '#55cc55', ring: '#3aa165', link: '#167a45' },
  { id: 'notgreen1', name: 'Not green 1',                bg: '#ffcccc', accent: '#ff9999', accentDark: '#ee5555', ring: '#cc4444', link: '#8b1a1a' },
  { id: 'notgreen2', name: 'Not green 2',                bg: '#ccccff', accent: '#9999ff', accentDark: '#5555ee', ring: '#4444cc', link: '#1a1a8b' },
  { id: 'notgreen3', name: 'Not green 3',                bg: '#ffffcc', accent: '#ffff88', accentDark: '#cccc33', ring: '#8b8b00', link: '#5a5a00' },
  { id: 'notgreen4', name: 'Not green 4',                bg: '#ffccff', accent: '#ff99ff', accentDark: '#dd44dd', ring: '#aa00aa', link: '#6a006a' },
  { id: 'notgreen5', name: 'Not green 5',                bg: '#ccffff', accent: '#88ffff', accentDark: '#33cccc', ring: '#007a7a', link: '#005a5a' },
  { id: 'white',     name: 'Really really light green',  bg: '#ffffff', accent: '#ccffcc', accentDark: '#88cc88', ring: '#3aa165', link: '#167a45' },
];

const THEME_STORAGE_KEY = 'uwudocs.theme';

function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.style.setProperty('--bg', theme.bg);
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-dark', theme.accentDark);
  root.style.setProperty('--ring', theme.ring);
  root.style.setProperty('--link', theme.link);
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);

  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === theme.id);
  });

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', theme.bg);
}

function buildThemePicker() {
  const grid = document.getElementById('theme-grid');
  if (!grid) return;
  grid.innerHTML = '';
  THEMES.forEach(theme => {
    const btn = document.createElement('button');
    btn.className = 'theme-swatch';
    btn.type = 'button';
    btn.dataset.theme = theme.id;
    btn.setAttribute('aria-label', `Apply ${theme.name} theme`);
    btn.innerHTML = `
      <span class="swatch-dot" style="background:${theme.bg};"></span>
      <span class="swatch-name">${theme.name}</span>
    `;
    btn.addEventListener('click', () => applyTheme(theme.id));
    grid.appendChild(btn);
  });
}

function initTheme() {
  buildThemePicker();
  const saved = localStorage.getItem(THEME_STORAGE_KEY) || 'classic';
  applyTheme(saved);
}

/* ─── Shared modal open/close animation ───
   Removes .hidden then waits a frame before adding .open, so the browser
   registers the opacity:0/translateY starting point instead of jumping
   straight to the end state. Closing reverses the order, holding .hidden
   off until the fade-out transition actually finishes. Reused by the
   theme picker below and by search.js for the Ctrl+K modal. */
function openModal(modal, focusEl) {
  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('open'));
  if (focusEl) setTimeout(() => focusEl.focus(), 0);
}

function closeModal(modal, focusEl) {
  modal.classList.remove('open');
  const onEnd = e => {
    if (e.target !== modal) return;
    modal.classList.add('hidden');
    modal.removeEventListener('transitionend', onEnd);
  };
  modal.addEventListener('transitionend', onEnd);
  if (focusEl) focusEl.focus();
}

function attachThemeModal() {
  const modal = document.getElementById('theme-modal');
  const openBtn = document.getElementById('theme-toggle');
  const closeBtn = document.getElementById('close-theme-modal');
  if (!modal || !openBtn || !closeBtn) return;

  function open() {
    openModal(modal, closeBtn);
  }
  function close() {
    closeModal(modal, openBtn);
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  attachThemeModal();
});
