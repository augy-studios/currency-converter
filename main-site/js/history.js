'use strict';

/* Conversion history: every conversion that settles, kept on this device under
   `uwuconvert.history`, newest first, and shown in the History card under the graph.

   A conversion settles when it's asked for (Convert, Enter, Swap, picking a currency) or when the
   amount has been left alone for a moment while typing, so 1, 10 and 100 on the way to 100 aren't
   three entries. The same pair converted again within a few seconds replaces the last entry
   rather than adding another; anything else is a new entry. At most MAX entries are kept, the
   oldest going first.

   An entry: { id, at, amount, from, to, rate, result, date }
     id      12 characters, made here, the same on every device it's copied to
     at      when it was converted, in ms since 1970
     amount  what was converted; from, to: ISO codes
     rate    1 from = rate to, as the API gave it; result = amount × rate
     date    the date the rate is from (YYYY-MM-DD)

   js/sync.js copies entries between devices (docs/STUN-p2p-spec.md). Entries never change once
   made, so merging is a union by id: nothing is overwritten and nothing removed. The app keeps
   the same key and shape (flutter/lib/data/history.dart), and its tests check the two agree.

   Needs from script.js: currencies (for names) and applyHistory(entry), which puts an entry
   back in the converter. */
(function () {
  const KEY = 'uwuconvert.history';
  const MAX = 500;
  // Converting the same pair again within this long replaces the last entry.
  const REPLACE_MS = 10000;
  // Shown before "Show all".
  const SHORT = 8;

  const CODE_RE = /^[A-Z0-9]{2,10}$/;
  const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  const $ = (id) => document.getElementById(id);
  const listeners = new Set();
  let showAll = false;

  function makeId() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
  }

  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

  // One entry from storage or another device, checked field by field; null if it isn't one.
  function cleanEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const amount = num(raw.amount);
    const rate = num(raw.rate);
    const at = num(raw.at);
    if (!ID_RE.test(raw.id) || !CODE_RE.test(raw.from) || !CODE_RE.test(raw.to)) return null;
    if (!(amount >= 0 && amount < 1e15) || !(rate > 0 && rate < 1e12) || !(at > 0 && at < 8.64e15)) return null;
    const result = num(raw.result);
    return {
      id: raw.id,
      at: Math.floor(at),
      amount,
      from: raw.from,
      to: raw.to,
      rate,
      result: result >= 0 ? result : amount * rate,
      date: DATE_RE.test(raw.date) ? raw.date : '',
    };
  }

  // A list from storage or another device: clean entries, each id once, newest first, capped.
  function clean(raw) {
    if (!Array.isArray(raw)) return null;
    const seen = new Set();
    const out = [];
    for (const r of raw.slice(0, MAX * 2)) {
      const e = cleanEntry(r);
      if (!e || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
    return sort(out).slice(0, MAX);
  }

  // Newest first; the same moment by id, so every device orders a list the same way.
  const sort = (list) => list.sort((a, b) => b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  function all() {
    try {
      return clean(JSON.parse(localStorage.getItem(KEY) || '[]')) || [];
    } catch {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {
      // Full or private: shown for this page view only.
    }
    render();
    listeners.forEach((fn) => {
      try { fn(); } catch { /* one listener's trouble isn't the others' */ }
    });
  }

  // A conversion that settled. `now` is for tests.
  function record({ amount, from, to, rate, date }, now = Date.now()) {
    const entry = cleanEntry({ id: makeId(), at: now, amount, from, to, rate, result: amount * rate, date });
    if (!entry) return null;
    const list = all();
    const last = list[0];
    if (last && last.from === entry.from && last.to === entry.to && now - last.at < REPLACE_MS) {
      // The same pair a moment ago: this one's the settled version of it, in its place. A new
      // id all the same, so an entry never changes once made, even one already copied elsewhere.
      list[0] = entry;
    } else if (last && last.from === entry.from && last.to === entry.to && last.amount === entry.amount && last.rate === entry.rate) {
      // Exactly the last one again: nothing new to remember.
      return last;
    } else {
      list.unshift(entry);
    }
    save(list);
    return entry;
  }

  // Entries from another device, merged in. Says how many were new here.
  function merge(entries) {
    const list = all();
    const have = new Set(list.map((e) => e.id));
    const fresh = (clean(entries) || []).filter((e) => !have.has(e.id));
    if (fresh.length) save(sort([...list, ...fresh]).slice(0, MAX));
    return fresh.length;
  }

  function remove(id) {
    save(all().filter((e) => e.id !== id));
  }

  function clear() {
    save([]);
  }

  /* ---- words ---- */

  const amountFmt = new Intl.NumberFormat(navigator.language || 'en-SG', { maximumFractionDigits: 2 });
  const rateFmt = new Intl.NumberFormat(navigator.language || 'en-SG', { maximumFractionDigits: 6 });
  const whenFmt = new Intl.DateTimeFormat(navigator.language || 'en-SG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const line = (e) => `${amountFmt.format(e.amount)} ${e.from} → ${amountFmt.format(e.result)} ${e.to}`;
  const sub = (e) => `1 ${e.from} = ${rateFmt.format(e.rate)} ${e.to} · ${whenFmt.format(new Date(e.at))}`;

  /* ---- the card ---- */

  const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  function render() {
    const listEl = $('historyList');
    if (!listEl) return;
    const list = all();
    const shown = showAll ? list : list.slice(0, SHORT);
    $('historyEmpty').hidden = list.length > 0;
    $('historyClear').hidden = list.length === 0;
    $('historyMore').hidden = list.length <= SHORT;
    $('historyMore').textContent = showAll ? 'Show fewer' : `Show all ${list.length}`;
    $('historyCount').textContent = list.length ? `${list.length} saved on this device` : '';

    listEl.replaceChildren(...shown.map((e) => {
      const li = document.createElement('li');
      li.className = 'historyItem';
      li.dataset.id = e.id;

      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'historyOpen';
      open.title = 'Convert this again';
      const main = document.createElement('span');
      main.className = 'historyLine';
      main.textContent = line(e);
      const small = document.createElement('span');
      small.className = 'historySub';
      small.textContent = sub(e);
      open.append(main, small);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'historyDelete icon-btn small';
      del.setAttribute('aria-label', `Remove ${line(e)} from history`);
      del.title = 'Remove';
      del.innerHTML = ICON_X;

      li.append(open, del);
      return li;
    }));
  }

  function init() {
    $('historyList').addEventListener('click', (e) => {
      const item = e.target.closest('.historyItem');
      if (!item) return;
      const entry = all().find((x) => x.id === item.dataset.id);
      if (!entry) return;
      if (e.target.closest('.historyDelete')) remove(entry.id);
      else window.applyHistory?.(entry);
    });
    $('historyMore').addEventListener('click', () => {
      showAll = !showAll;
      render();
    });
    $('historyClear').addEventListener('click', () => {
      if (confirm('Clear every conversion saved on this device? Other devices keep theirs.')) clear();
    });
    $('historySync').addEventListener('click', () => window.Sync?.open());
    // Another tab of the site converting.
    addEventListener('storage', (e) => {
      if (e.key === KEY) render();
    });
    render();
  }

  window.ConvHistory = {
    KEY, MAX, all, clean, cleanEntry, record, merge, remove, clear, init, render, line, sub,
    onChange: (fn) => listeners.add(fn),
  };
})();
