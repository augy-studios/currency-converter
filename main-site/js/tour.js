'use strict';

/* Page tours (docs/page-tour-spec.md): a short walk through what's on screen, the first time
   it's seen, and again from Show me around in the edge tray. The site is one page, so the tours
   are its parts rather than pages of their own:

     welcome   the converter, the edge tray and Sync, the first time the site opens
     graph     the historical rates graph
     history   the conversion history, and sharing it with another device

   Each step points at something on the page. The page scrolls to bring it into view, and the
   card and its arrow are kept on screen beside it, following it as the page scrolls or the
   window changes size (place()). A step whose target isn't on the page at all (a tray tucked
   away, a history still empty) is skipped.

   What it needs from script.js: a `pagechange` event on window once the converter is drawn. */
(function () {
  const WELCOME_KEY = 'uwuconvert.tour.welcome';
  const PAGES_KEY = 'uwuconvert.tour.pages';
  const PAD = 8;
  const WELCOME = 'welcome';
  // The page's own parts: a tour for each, and the welcome joined to the first seen.
  const VIEWS = ['home'];

  const hasHistory = () => !!document.querySelector('#historyList .historyItem');

  // Each tour's steps: `el` a selector (alternatives allowed, the first match on the page is
  // used), `text` one line, `when` an optional test for whether the step applies. `page` is
  // what has to be on screen for it; `available` whether it can be replayed just now, and
  // `why` what to do if not.
  const TOURS = {
    welcome: {
      label: 'Welcome',
      steps: [
        { el: '#amount', text: 'Type an amount here. It converts as you type.' },
        { el: '#from', text: 'Pick the currency you have. Type a code like USD, or a name like Euro.' },
        { el: '#swap', text: 'Swap turns the conversion round.' },
        { el: '#to', text: 'And the currency you want.' },
        { el: '.result', text: 'The answer, and the rate it used. Share sends it to a friend or saves it as a picture.' },
        { el: '#trayButtons, #trayTab', text: 'Theme, History, Sync, Show me around and Report a bug live here. Press and hold one to see what it does; the arrow tucks them away.' },
      ],
    },
    graph: {
      label: 'Historical rates',
      page: 'home',
      steps: [
        { el: '#range-picker', text: 'How far back to look: from five days to every day there is.' },
        { el: '#add-currency', text: 'Add currencies to compare. With more than one, each starts at 100, so their changes line up.' },
        { el: '.graph-canvas-wrap', text: 'Hover or touch the graph to read the rate on any day.' },
      ],
    },
    history: {
      label: 'History',
      page: 'home',
      steps: [
        { el: '#historyList .historyItem', text: 'Every conversion is kept here, on this device only. Press one to convert it again.', when: hasHistory },
        { el: '#historyCard', text: 'Your conversions are kept here, on this device only, as you make them.', when: () => !hasHistory() },
        { el: '#historySync', text: 'Share copies your history straight to your other phone or computer, no account needed.' },
        { el: '#historyClear', text: 'Clear forgets them all on this device. Other devices keep theirs.', when: hasHistory },
      ],
    },
  };

  /* ---- what's on screen ---- */

  const pages = {
    // `null` before the converter is drawn; `home` after.
    active() {
      return document.body.classList.contains('app-ready') ? 'home' : null;
    },
    open() {
      // One page: nothing to open.
    },
  };

  // A window open over the page.
  function windowOpen() {
    return [...document.querySelectorAll('.modal-backdrop:not(.hidden)')].length > 0;
  }

  // The page waits for the currencies to load; the tours wait for the page.
  const ready = () => document.body.classList.contains('app-ready');

  /* ---- state ---- */

  let steps = [];
  let at = 0;
  let root = null; // the layer, or `true` while a tour is getting ready
  let marks = [];  // the tours this one counts as, once it ends
  let began = null;

  function seen(id) {
    try {
      if (id === WELCOME) return localStorage.getItem(WELCOME_KEY) === 'done';
      return JSON.parse(localStorage.getItem(PAGES_KEY) || '[]').includes(id);
    } catch {
      // Broken storage counts every tour as seen, rather than showing one on every visit.
      return true;
    }
  }

  function markSeen(id) {
    try {
      if (id === WELCOME) return localStorage.setItem(WELCOME_KEY, 'done');
      const list = JSON.parse(localStorage.getItem(PAGES_KEY) || '[]');
      if (!list.includes(id)) localStorage.setItem(PAGES_KEY, JSON.stringify([...list, id]));
    } catch { /* shown again next time */ }
  }

  // On the page: not hidden, not tucked away (an inert tray), and drawn with a size. Not
  // necessarily in view: show() scrolls the page to it, so a step further down the page is
  // shown there rather than skipped.
  function visible(el) {
    if (!el || el.closest('[hidden], .hidden, [inert]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  // The alternatives in the order they're written, not the page's: "the Sync button, or the
  // tray's tab while it's collapsed" must not pick the tab, which comes first in the page.
  function target(s) {
    for (const sel of s.el.split(',')) {
      const el = [...document.querySelectorAll(sel.trim())].find(visible);
      if (el) return el;
    }
    return null;
  }

  /* ---- drawing ---- */

  function build() {
    root = document.createElement('div');
    root.className = 'tour';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'tourText');
    root.innerHTML =
      '<div class="tourHole"></div>' +
      '<svg class="tourArrow" aria-hidden="true"><defs><filter id="tourChalk"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>' +
      '<path class="tourLine" filter="url(#tourChalk)"/><path class="tourHead" filter="url(#tourChalk)"/></svg>' +
      '<button class="tourSkip" type="button">Skip</button>' +
      '<div class="tourCard"><p id="tourText" class="tourText" aria-live="polite"></p>' +
      '<div class="tourFoot"><span class="tourDots" aria-hidden="true"></span><button class="tourNext" type="button">Next</button></div></div>';
    document.body.appendChild(root);
    root.querySelector('.tourSkip').addEventListener('click', end);
    root.querySelector('.tourNext').addEventListener('click', next);
    root.addEventListener('keydown', (e) => {
      // Handled here, so the page's own Escape (which closes every window) leaves it be.
      if (e.key === 'Escape') { e.preventDefault(); end(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    });
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
  }

  function show(i) {
    at = i;
    const el = steps[i].target;
    // A tall element from its top, so its top edge isn't lost.
    const tall = el.getBoundingClientRect().height > innerHeight * 0.6;
    el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: 'instant' });
    root.querySelector('.tourText').textContent = steps[i].text;
    root.querySelector('.tourDots').innerHTML = steps.map((_, n) => `<span${n === i ? ' class="on"' : ''}></span>`).join('');
    root.querySelector('.tourNext').textContent = i === steps.length - 1 ? 'Done' : 'Next';
    requestAnimationFrame(place);
    root.querySelector('.tourNext').focus({ preventScroll: true });
  }

  // The hole, the card on the side with room, lined up with the element, and the arrow
  // between them, all of it on screen (the spec's §3).
  const M = 12;
  const EDGE = 20;
  const GAP_MIN = 36;
  const GAP_MAX = 70;
  const CARD_MIN = 220;
  const clamp = (lo, v, hi) => Math.max(lo, Math.min(v, Math.max(lo, hi)));

  function place() {
    if (!root || root === true) return;
    const el = steps[at]?.target;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight;
    const hole = root.querySelector('.tourHole');
    Object.assign(hole.style, {
      left: `${r.left - PAD}px`, top: `${r.top - PAD}px`,
      width: `${r.width + PAD * 2}px`, height: `${r.height + PAD * 2}px`,
    });

    const v = {
      left: Math.max(r.left, 0), right: Math.min(r.right, vw),
      top: Math.max(r.top, 0), bottom: Math.min(r.bottom, vh),
    };
    const card = root.querySelector('.tourCard');
    card.classList.remove('solid');
    card.style.width = '';
    let cw = card.offsetWidth, ch = card.offsetHeight;
    const room = {
      below: vh - v.bottom - PAD - M, above: v.top - PAD - M,
      right: vw - v.right - PAD - M, left: v.left - PAD - M,
    };
    let side = null;
    if (Math.max(room.below, room.above) >= ch + GAP_MIN) side = room.below >= room.above ? 'below' : 'above';
    else {
      const s = room.right >= room.left ? 'right' : 'left';
      const fit = room[s] - GAP_MIN;
      if (fit >= Math.min(cw, CARD_MIN)) {
        if (fit < cw) {
          card.style.width = `${fit}px`;
          cw = card.offsetWidth;
          ch = card.offsetHeight;
        }
        if (ch <= vh - M * 2) side = s;
        else card.style.width = '';
      }
    }

    const line = root.querySelector('.tourLine');
    const head = root.querySelector('.tourHead');
    let left, top;
    if (!side) {
      // No room for an arrow: the card on a backing, at the end away from most of the element.
      card.classList.add('solid');
      cw = card.offsetWidth;
      ch = card.offsetHeight;
      left = (vw - cw) / 2;
      top = (v.top + v.bottom) / 2 > vh / 2 ? M : vh - ch - M;
      Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
      line.setAttribute('d', '');
      head.setAttribute('d', '');
      return;
    }

    const midX = (v.left + v.right) / 2, midY = (v.top + v.bottom) / 2;
    let sx, sy, tx, ty;
    if (side === 'below' || side === 'above') {
      const gap = clamp(GAP_MIN, room[side] - ch, GAP_MAX);
      left = clamp(M, midX - cw / 2, vw - cw - M);
      top = side === 'below' ? v.bottom + PAD + gap : v.top - PAD - gap - ch;
      top = clamp(M, top, vh - ch - M);
      tx = clamp(v.left + 12, midX, v.right - 12);
      ty = side === 'below' ? v.bottom + PAD + 4 : v.top - PAD - 4;
      sx = clamp(left + 24, tx, left + cw - 24);
      sy = side === 'below' ? top - 6 : top + ch + 6;
    } else {
      const gap = clamp(GAP_MIN, room[side] - cw, GAP_MAX);
      left = side === 'right' ? v.right + PAD + gap : v.left - PAD - gap - cw;
      left = clamp(M, left, vw - cw - M);
      top = clamp(M, midY - ch / 2, vh - ch - M);
      tx = side === 'right' ? v.right + PAD + 4 : v.left - PAD - 4;
      ty = clamp(v.top + 12, midY, v.bottom - 12);
      sx = side === 'right' ? left - 6 : left + cw + 6;
      sy = clamp(top + 16, ty, top + ch - 16);
    }
    Object.assign(card.style, { left: `${left}px`, top: `${top}px` });

    // Every point of the arrow EDGE in from the viewport, so none of it is cut off.
    const inX = (x) => clamp(EDGE, x, vw - EDGE);
    const inY = (y) => clamp(EDGE, y, vh - EDGE);
    tx = inX(tx); ty = inY(ty); sx = inX(sx); sy = inY(sy);
    const dx = tx - sx, dy = ty - sy;
    const mx = inX((sx + tx) / 2 - dy * 0.2);
    const my = inY((sy + ty) / 2 + dx * 0.2);

    root.querySelector('.tourArrow').setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    line.setAttribute('d', `M${sx},${sy} Q${mx},${my} ${tx},${ty}`);
    line.style.setProperty('--len', Math.ceil(line.getTotalLength()) + 10);
    const ang = Math.atan2(ty - my, tx - mx);
    const a1 = ang + Math.PI * 0.8, a2 = ang - Math.PI * 0.8, len = 14;
    head.setAttribute('d',
      `M${tx + Math.cos(a1) * len},${ty + Math.sin(a1) * len} L${tx},${ty} L${tx + Math.cos(a2) * len},${ty + Math.sin(a2) * len}`);
  }

  /* ---- running ---- */

  function next() {
    if (at < steps.length - 1) show(at + 1);
    else end();
  }

  function end() {
    for (const id of marks) markSeen(id);
    marks = [];
    removeEventListener('resize', place);
    removeEventListener('scroll', place, true);
    if (root && root !== true) root.remove();
    root = null;
    document.body.classList.remove('touring');
    const back = began;
    began = null;
    // Back where it began (its own view again, if it was shown as the other), which may be a
    // page whose own tour is still to see.
    if (back && pages.active() !== back) pages.open(back);
    else setTimeout(forPage, 600);
  }

  // `id`'s tour, on its page. With `withWelcome`, the welcome's steps follow its own, as the
  // first tour anyone sees; `id` may then be `empty`, which has no steps of its own.
  function start(id, { withWelcome = false } = {}) {
    const tour = TOURS[id];
    if (root || (!tour && !withWelcome)) return;
    const from = pages.active();
    if (!from) return;
    const goTo = tour?.page;
    if (goTo && from !== goTo) pages.open(goTo);
    root = true; // taken, while the page draws
    setTimeout(() => {
      root = null;
      const list = [...(tour?.steps || []), ...(withWelcome && id !== WELCOME ? TOURS.welcome.steps : [])];
      steps = list
        .filter((s) => !s.when || s.when())
        .map((s) => ({ ...s, target: target(s) }))
        .filter((s) => s.target);
      // Two steps can land on the same thing, such as the collapsed tray's tab.
      steps = steps.filter((s, i) => i === 0 || s.target !== steps[i - 1].target);
      const done = [...(withWelcome ? [WELCOME] : []), ...(tour ? [id] : [])];
      if (!steps.length) {
        done.forEach(markSeen);
        if (pages.active() !== from) pages.open(from);
        return;
      }
      marks = done;
      began = from;
      document.body.classList.add('touring');
      build();
      show(0);
    }, !goTo || from === goTo ? 0 : 400);
  }

  // The tour for what's on screen, the first time, once it's drawn: the welcome joined to the
  // view's own steps if the welcome's still to see, or that page's own tour.
  let waiting = null;
  function forPage() {
    if (root) return;
    const id = pages.active();
    if (!id) return;
    const welcome = !seen(WELCOME) && (VIEWS.includes(id) || id === 'empty');
    if (!welcome && (!TOURS[id] || seen(id))) return;
    clearInterval(waiting);
    let tries = 0;
    waiting = setInterval(() => {
      tries++;
      if (pages.active() !== id || root) return clearInterval(waiting);
      if (ready(id) ? tries < 2 : tries <= 16) return;
      clearInterval(waiting);
      if (!windowOpen(id)) start(id, { withWelcome: welcome });
    }, 500);
  }

  // Once the app is on screen: the first tour, unless a link opened something.
  let started = false;
  function init() {
    if (started) return;
    started = true;
    addEventListener('pagechange', forPage);
    if (location.hash.length > 1 || location.search) return;
    forPage();
  }

  // "Show me around": a button per tour, each only while there's something for it to show.
  const ORDER = ['welcome', 'graph', 'history'];
  function pickers() {
    return ORDER.map((id) => {
      const t = TOURS[id];
      const off = t.available && !t.available();
      return `<button class="btn-ghost" type="button" data-tour="${id}"${off ? ` disabled title="${t.why}"` : ''}>${t.label}</button>`;
    }).join('');
  }

  window.Tour = { init, start, end, pickers, active: () => !!root };
})();
