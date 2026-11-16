'use strict';

/* Sharing conversion history, and the theme, with another device, from the Sync window (the
   tray's Sync button, or Share with another device on the History card).

   One device shows a code (with a link and a QR code of it), the other enters it. PeerJS's
   public broker introduces the two, then everything goes straight from one to the other over
   a WebRTC data channel, STUN only (js/p2p.js; docs/STUN-p2p-spec.md says why). So both have
   to be on the same network, or one on the other's hotspot. The app (flutter/) speaks the same
   wire, so a phone and a browser share with each other as two browsers do.

   Once connected, each side sees the other's conversions and ticks which to import, or which of
   its own to send over, or all of them. Copying adds and never removes or overwrites: entries
   never change once made (js/history.js), so a merge is a union by id. The theme is one of a
   thing, so taking the other's replaces this one's. Closing the Sync window ends the session.

   The wire, on top of p2p.js's hello and bye:
     { type: 'history', entries, theme }  either way: all of the sender's conversions and its
                                          theme, on connecting (the host in answer to hello)
                                          and whenever they change.
     { type: 'add', id, entries, theme }  either way: merge these into yours.
     { type: 'added', id, count }         the answer to add, with how many things were new there.

   Every message is input from another device: checked against an allowlist of types, each
   entry checked field by field (ConvHistory.clean), unknown types ignored, never thrown on. */
(function () {
  const HOST_KEY = 'uwuconvert.sync.hostCode';
  const LAST_KEY = 'uwuconvert.sync.lastCode';

  // How long the other device has to answer an add before this one says it heard nothing.
  const ACK_MS = 6000;

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const tap = (selector) => document.querySelector(selector)?.click();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ---- the theme ---- */

  // Each: its label, what it starts as (only one changed from that is offered, so taking the
  // other's never just undoes a choice), its value as words, and how it's read and put in
  // place, through the theme window's own buttons so the window follows as if tapped.
  const SETTINGS = {
    mode: {
      label: 'Light or dark', start: 'light',
      values: () => ['light', 'dark', 'time'],
      text: (v) => ({ light: 'Light', dark: 'Dark', time: 'Time-based' })[v] || v,
      get: () => window.getModePreference?.() || 'light',
      set: (v) => tap(`#modeToggle [data-mode="${v}"]`),
    },
    colour: {
      label: 'Brand colour', start: 'classic',
      values: () => (window.COLOR_THEMES || []).map((t) => t.id),
      text: (v) => (window.COLOR_THEMES || []).find((t) => t.id === v)?.label || v,
      get: () => window.getStoredColorTheme?.() || 'classic',
      set: (v) => tap(`#swatchGrid [data-theme-id="${v}"]`),
    },
  };

  const settingOk = (field, value) => Object.hasOwn(SETTINGS, field) && typeof value === 'string' && SETTINGS[field].values().includes(value);

  function ownTheme() {
    return Object.entries(SETTINGS)
      .filter(([, s]) => s.get() !== s.start)
      .map(([field, s]) => ({ field, value: s.get() }));
  }

  function cleanTheme(raw) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw.slice(0, 10) : [])
      .filter((s) => settingOk(s?.field, s?.value) && !seen.has(s.field) && seen.add(s.field))
      .map((s) => ({ field: s.field, value: s.value }));
  }

  // Merges conversions and theme from the other device into this one, and says how many things
  // that changed.
  function mergeIn(entries, theme) {
    let count = 0;
    for (const { field, value } of theme) {
      if (SETTINGS[field].get() !== value) {
        SETTINGS[field].set(value);
        count++;
      }
    }
    return count + ConvHistory.merge(entries);
  }

  /* ---- sessions ---- */

  const sync = {
    role: null,        // 'host' | 'guest' while a session runs
    conn: null,        // its P2P.Host or P2P.Guest
    status: 'idle',
    theirs: null,      // the other side's { entries, theme }, once they've arrived
    tab: 'import',
    picked: { import: new Set(), export: new Set() },
    pending: new Map(), // add id -> timer, for sends not yet answered
    lastId: 0,
    retriedTaken: false,
    droppedCode: '',
    wakeLock: null,
    pendingLink: '',
  };

  function readKey(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }

  function writeKey(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch { /* private mode: codes just aren't remembered */ }
  }

  const syncLink = (code) => `${location.origin}/#sync/${code}`;

  function beginSession(role) {
    sync.role = role;
    sync.status = 'connecting';
    sync.theirs = null;
    sync.droppedCode = '';
    sync.tab = 'import';
    sync.picked.import.clear();
    sync.picked.export.clear();
    showNote('');
    holdScreenOn();
  }

  // Tears down whatever is running. `bye` is for a guest leaving on purpose, which retires the
  // host's code; anything else just closes.
  function endSession({ bye = false, text: message = '', tone = 'busy' } = {}) {
    const conn = sync.conn;
    // Cleared first, so the status the closing connection reports on its way out is ignored.
    sync.conn = null;
    if (conn) {
      if (bye && sync.role === 'guest') conn.leave();
      else conn.close();
    }
    for (const timer of sync.pending.values()) clearTimeout(timer);
    sync.pending.clear();
    sync.role = null;
    sync.status = 'idle';
    sync.theirs = null;
    releaseScreen();
    showStatus(message, tone);
    render();
  }

  // Stop, Cancel or Disconnect, or the window closing.
  function stop() {
    sync.droppedCode = '';
    if (sync.role) endSession({ bye: true });
  }

  async function startHosting() {
    if (sync.role) return;
    const stored = readKey(HOST_KEY);
    const code = P2P.isValidCode(stored) ? stored : P2P.generateCode();
    writeKey(HOST_KEY, code);

    beginSession('host');
    $('syncCode').textContent = code;
    $('syncLink').textContent = syncLink(code);
    $('syncQr').innerHTML = window.qrToSvg ? qrToSvg(syncLink(code)) : '';

    const host = new P2P.Host({ maxGuests: 1 });
    sync.conn = host;
    host.addEventListener('status', ({ detail }) => {
      if (sync.conn !== host) return;
      // The stored code is held by something else: another tab, or the broker not yet letting
      // go of it after a reload. A fresh one, once; a second collision in a row is not stale.
      if (detail.taken && !sync.retriedTaken) {
        sync.retriedTaken = true;
        newHostCode();
        return;
      }
      if (detail.status === 'error') {
        if (detail.taken) writeKey(HOST_KEY, '');
        endSession({ text: detail.message, tone: 'error' });
        return;
      }
      if (detail.status === 'waiting') sync.retriedTaken = false;
      onStatus(detail.status);
    });
    // A newcomer replaces the device that was connected, whose history no longer applies.
    host.addEventListener('join', () => {
      if (sync.conn !== host) return;
      sync.theirs = null;
      renderList();
    });
    host.addEventListener('message', ({ detail }) => {
      if (sync.conn === host) onMessage(detail.message);
    });
    render();

    try {
      await host.start(code);
    } catch {
      if (sync.conn === host) endSession({ text: 'Could not load sharing. Check your connection.', tone: 'error' });
    }
  }

  // Gives up the code on show for a fresh one, which the old one stops working the moment it does.
  async function newHostCode(note = '') {
    endSession();
    writeKey(HOST_KEY, '');
    await startHosting();
    if (note) showNote(note);
  }

  async function join(input) {
    const code = P2P.normaliseCode(input);
    if (!P2P.isValidCode(code)) {
      showStatus(`The code is the ${P2P.CODE_LENGTH} letters and numbers on the other device’s screen.`, 'error');
      return;
    }
    if (sync.role) endSession();

    beginSession('guest');
    writeKey(LAST_KEY, code);
    $('syncCodeInput').value = code;

    const guest = new P2P.Guest();
    sync.conn = guest;
    guest.addEventListener('status', ({ detail }) => {
      if (sync.conn !== guest) return;
      const { status } = detail;
      if (status === 'dropped') {
        endSession({ text: 'Lost the connection to the other device. Press Connect to try again.', tone: 'warn' });
        sync.droppedCode = code;
      } else if (status === 'unreachable') {
        endSession({
          text: 'Could not reach the other device. Both have to be on the same network: join the same wifi, or turn on a hotspot on one and join it from the other. Check the code is still the one on screen.',
          tone: 'error',
        });
      } else if (status === 'error') {
        endSession({ text: detail.message, tone: 'error' });
      } else {
        onStatus(status);
      }
    });
    guest.addEventListener('message', ({ detail }) => {
      if (sync.conn === guest) onMessage(detail.message);
    });
    render();

    try {
      await guest.connect(code);
    } catch {
      if (sync.conn === guest) endSession({ text: 'Could not load sharing. Check your connection.', tone: 'error' });
    }
  }

  function onStatus(status) {
    const was = sync.status;
    sync.status = status;
    if (status !== 'connected') sync.theirs = null;
    // The host answers p2p.js's hello with its history; this is ours for it.
    else if (was !== 'connected' && sync.role === 'guest') sendHistory();
    render();
  }

  const send = (message) => sync.conn?.send(message);

  // Ids for add, odd on the host and even on the guest, so an answer to one side's request is
  // never taken for an answer to the other's.
  const nextId = () => ++sync.lastId * 2 + (sync.role === 'host' ? 1 : 0);

  function sendHistory() {
    send({ type: 'history', entries: ConvHistory.all(), theme: ownTheme() });
  }

  // This device's history changed: the other side's lists follow.
  let changeTimer = null;
  function changed() {
    if (sync.status !== 'connected') return;
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      if (sync.status === 'connected') sendHistory();
      renderList();
    }, 300);
  }

  /* ---- messages ---- */

  // Everything the other device sends goes through here. Unknown types are ignored, never
  // thrown on: the other device may be a version ahead or behind.
  function onMessage(message) {
    switch (message.type) {
      case 'hello':
        if (sync.role === 'host') sendHistory();
        break;

      case 'history': {
        const entries = ConvHistory.clean(message.entries);
        if (!entries) break;
        sync.theirs = { entries, theme: cleanTheme(message.theme) };
        renderList();
        break;
      }

      case 'add':
        onAdd(message);
        break;

      case 'added': {
        const timer = sync.pending.get(message.id);
        if (timer === undefined) break;
        clearTimeout(timer);
        sync.pending.delete(message.id);
        const count = Math.max(0, Math.min(ConvHistory.MAX + 10, Math.floor(Number(message.count)) || 0));
        showNote(count
          ? `Sent. The other device took ${count === 1 ? '1 new thing' : `${count} new things`}.`
          : 'Sent. The other device already had all of those.');
        break;
      }

      // The guest is finished with this code, so nobody else gets to use it.
      case 'bye':
        if (sync.role === 'host') newHostCode('The other device disconnected. The old code no longer works; this is a new one.');
        break;

      default:
        break;
    }
  }

  function onAdd(message) {
    const entries = ConvHistory.clean(message.entries);
    if (!entries || !Number.isInteger(message.id)) return;
    const count = mergeIn(entries, cleanTheme(message.theme));
    send({ type: 'added', id: message.id, count });
    if (count) sendHistory();
    showNote(count
      ? `The other device sent ${count === 1 ? '1 thing' : `${count} things`}, now saved here.`
      : 'The other device sent things this device already has.');
    renderList();
  }

  /* ---- copying ---- */

  // Every conversion and setting on one side as items, each keyed the same way on both devices.
  function items(side) {
    if (!side) return [];
    return [
      ...side.entries.map((e) => ({ key: `conv:${e.id}`, kind: 'conv', item: e })),
      ...side.theme.map((s) => ({ key: `setting:${s.field}=${s.value}`, kind: 'setting', item: s })),
    ];
  }

  const own = () => ({ entries: ConvHistory.all(), theme: ownTheme() });
  const source = () => (sync.tab === 'import' ? sync.theirs : own());
  const dest = () => (sync.tab === 'import' ? own() : sync.theirs);

  // What's on offer in the tab on show, and whether each is already at the other end.
  function offered() {
    const from = source();
    const to = dest();
    if (!from || !to) return [];
    const have = new Set(to.entries.map((e) => e.id));
    return items(from).map((f) => {
      if (f.kind === 'setting') {
        const there = f.item.value === (sync.tab === 'import'
          ? SETTINGS[f.item.field].get()
          : to.theme.find((s) => s.field === f.item.field)?.value || SETTINGS[f.item.field].start);
        return { ...f, done: there };
      }
      return { ...f, done: have.has(f.item.id) };
    });
  }

  function copyPicked() {
    const picked = sync.picked[sync.tab];
    if (!picked.size || !source()) return;
    const chosen = items(source()).filter((f) => picked.has(f.key));
    const entries = chosen.filter((f) => f.kind === 'conv').map((f) => f.item);
    const theme = chosen.filter((f) => f.kind === 'setting').map((f) => f.item);
    picked.clear();

    if (sync.tab === 'import') {
      // Everything the other side has is here already: merged straight in.
      const count = mergeIn(entries, theme);
      showNote(count === 1 ? 'Imported 1 thing to this device.' : `Imported ${count} things to this device.`);
      if (count) sendHistory();
    } else {
      const id = nextId();
      const n = chosen.length;
      showNote(n === 1 ? 'Sending 1 thing…' : `Sending ${n} things…`);
      send({ type: 'add', id, entries, theme });
      sync.pending.set(id, setTimeout(() => {
        sync.pending.delete(id);
        showNote('No answer from the other device. Check it still says connected, then try again.', 'error');
      }, ACK_MS));
    }
    renderList();
  }

  function copyLink() {
    const link = $('syncLink').textContent;
    if (!link || !navigator.clipboard) return;
    navigator.clipboard.writeText(link)
      .then(() => showNote('Link copied.'))
      .catch(() => showNote('Couldn’t copy the link. Type the code on the other device instead.', 'error'));
  }

  /* ---- screen wake lock ---- */

  // A phone that locks mid-share suspends the page and drops the channel with it.
  async function holdScreenOn() {
    if (!sync.role || sync.wakeLock || !navigator.wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!sync.role) { lock.release().catch(() => {}); return; }
      sync.wakeLock = lock;
      lock.addEventListener('release', () => { if (sync.wakeLock === lock) sync.wakeLock = null; });
    } catch { /* battery saver, or not allowed: the session carries on without it */ }
  }

  function releaseScreen() {
    sync.wakeLock?.release().catch(() => {});
    sync.wakeLock = null;
  }

  /* ---- rendering ---- */

  function showStatus(message, tone = 'busy') {
    $('syncStatus').hidden = !message;
    $('syncStatusText').textContent = message;
    $('syncStatus').querySelector('.statusDot').className = `statusDot ${tone}`;
  }

  function showNote(message, tone = '') {
    $('syncNote').hidden = !message;
    $('syncNote').textContent = message;
    $('syncNote').classList.toggle('error', tone === 'error');
  }

  function render() {
    const { role, status } = sync;
    const connected = status === 'connected';

    $('syncStart').hidden = !!role;
    $('syncHost').hidden = role !== 'host' || connected;
    $('syncLive').hidden = !connected;
    $('syncControls').hidden = !role;
    $('syncNewCode').hidden = role !== 'host';
    $('syncEnd').textContent = connected ? 'Disconnect' : role === 'host' ? 'Stop' : 'Cancel';

    if (role === 'host' && status === 'waiting') {
      showStatus('Waiting for the other device. On it, open Share with another device and enter this code, or scan the QR code with its camera.', 'warn');
    } else if (role && status === 'connecting') {
      showStatus(role === 'host' ? 'Getting the code ready…' : 'Connecting to the other device…', 'busy');
    } else if (connected) {
      showStatus('Connected to the other device.', 'ok');
    }

    renderList();
  }

  function renderList() {
    if (sync.status !== 'connected') return;
    const importing = sync.tab === 'import';
    $$('#syncTabs [data-sync-tab]').forEach((tab) => {
      const on = tab.dataset.syncTab === sync.tab;
      tab.classList.toggle('active', on);
      tab.setAttribute('aria-selected', String(on));
    });
    $('syncListNote').textContent = importing
      ? 'The other device’s conversions and theme. Tick the ones to copy to this device.'
      : 'This device’s conversions and theme. Tick the ones to copy to the other device.';

    const picked = sync.picked[sync.tab];
    if (!sync.theirs) {
      picked.clear();
      $('syncList').innerHTML = '<div class="syncEmpty">Waiting for the other device…</div>';
      renderPicks([]);
      return;
    }

    const all = offered();
    // A pick the other end has since got some other way isn't on offer any more.
    const open = new Set(all.filter((f) => !f.done).map((f) => f.key));
    for (const key of picked) if (!open.has(key)) picked.delete(key);

    const row = ({ key, kind, item, done }) => {
      const title = kind === 'conv' ? ConvHistory.line(item) : SETTINGS[item.field].label;
      const sub = kind === 'conv' ? ConvHistory.sub(item) : SETTINGS[item.field].text(item.value);
      const tag = done ? (importing ? 'Already here' : 'Already there') : '';
      return `<label class="syncItem${done ? ' done' : ''}">` +
        `<input type="checkbox" data-sync-key="${esc(key)}"${done ? ' disabled' : picked.has(key) ? ' checked' : ''}>` +
        `<span class="syncItemText"><span class="name">${esc(title)}</span><span class="sub">${esc(sub)}</span></span>` +
        (tag ? `<span class="syncTag">${tag}</span>` : '') +
        '</label>';
    };
    const group = (kind, label) => {
      const rows = all.filter((f) => f.kind === kind);
      return rows.length ? `<div class="syncGroupLabel">${label}</div>${rows.map(row).join('')}` : '';
    };
    $('syncList').innerHTML = (group('conv', 'Conversions') + group('setting', 'Theme'))
      || `<div class="syncEmpty">${importing ? 'The other device has nothing to share yet.' : 'This device has nothing to share yet.'}</div>`;
    renderPicks(all);
  }

  // The Select all box and the button under the list, which follow the ticks without
  // redrawing the list.
  function renderPicks(all = offered()) {
    const importing = sync.tab === 'import';
    const picked = sync.picked[sync.tab];
    const open = all.filter((f) => !f.done);
    const ticked = open.filter((f) => picked.has(f.key)).length;
    const box = $('syncAll');
    box.disabled = !open.length;
    box.checked = open.length > 0 && ticked === open.length;
    box.indeterminate = ticked > 0 && ticked < open.length;

    const n = picked.size;
    const go = $('syncGo');
    go.disabled = !n;
    go.textContent = !n
      ? (importing ? 'Tick what to import' : 'Tick what to send')
      : importing
        ? (n === 1 ? 'Import 1 thing to this device' : `Import ${n} things to this device`)
        : (n === 1 ? 'Send 1 thing to the other device' : `Send ${n} things to the other device`);
  }

  /* ---- the window ---- */

  const modalOpen = () => !$('syncModal').classList.contains('hidden');

  // As the window opens: the last code this device joined with, ready to use again.
  function open() {
    openModal('syncModal');
    if (!sync.role && !$('syncCodeInput').value) $('syncCodeInput').value = readKey(LAST_KEY);
    render();
  }

  // A link from another device's QR code (#sync/CODE): the code filled in, waiting for a press
  // on Connect rather than connecting outright, since connecting shows this device's history to
  // whoever made the link.
  function openLink(code) {
    history.replaceState(null, '', location.pathname + location.search);
    open();
    if (sync.role) return;
    $('syncCodeInput').value = P2P.normaliseCode(code);
    showStatus('Press Connect to share with the device showing this code.', 'busy');
    $('syncJoinBtn').focus({ preventScroll: true });
  }

  function readLink() {
    const m = location.hash.match(/^#sync\/([A-Za-z0-9-]{1,20})$/);
    return m ? m[1] : '';
  }

  function init() {
    $('syncBtn').addEventListener('click', open);
    $('syncHostBtn').addEventListener('click', () => {
      sync.retriedTaken = false;
      startHosting();
    });
    $('syncJoinBtn').addEventListener('click', () => join($('syncCodeInput').value));
    $('syncCodeInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join(e.target.value);
    });
    $('syncCode').addEventListener('click', copyLink);
    $('syncNewCode').addEventListener('click', () => newHostCode());
    $('syncEnd').addEventListener('click', stop);

    $('syncTabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-sync-tab]');
      if (!tab) return;
      sync.tab = tab.dataset.syncTab;
      renderList();
      $('syncList').scrollTop = 0;
    });
    $('syncList').addEventListener('change', (e) => {
      const key = e.target.dataset.syncKey;
      if (!key) return;
      const picked = sync.picked[sync.tab];
      if (e.target.checked) picked.add(key);
      else picked.delete(key);
      renderPicks();
    });
    $('syncAll').addEventListener('change', (e) => {
      const picked = sync.picked[sync.tab];
      for (const { key, done } of offered()) {
        if (done) continue;
        if (e.target.checked) picked.add(key);
        else picked.delete(key);
      }
      $$('#syncList [data-sync-key]:not(:disabled)').forEach((box) => { box.checked = picked.has(box.dataset.syncKey); });
      renderPicks();
    });
    $('syncGo').addEventListener('click', copyPicked);

    // A session belongs to the open window, so nothing is left running out of sight. Watched
    // rather than hooked, as the window closes in several ways (its button, the backdrop,
    // Escape).
    new MutationObserver(() => {
      if (modalOpen()) return;
      stop();
      showStatus('');
      showNote('');
    }).observe($('syncModal'), { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      // The browser lets go of the wake lock whenever the page is hidden.
      if (sync.role) holdScreenOn();
      // Back from the background with a channel that died meanwhile. An unreachable one isn't
      // retried: the network hasn't changed, so the result wouldn't either.
      else if (sync.droppedCode && modalOpen()) join(sync.droppedCode);
    });
    // A link followed in a page already open.
    addEventListener('hashchange', () => {
      const code = readLink();
      if (code) openLink(code);
    });

    ConvHistory.onChange(changed);
    render();

    // A link from another device's QR code that opened this page.
    const code = readLink();
    if (code) openLink(code);
  }

  window.Sync = { init, open, changed, stop };
})();
