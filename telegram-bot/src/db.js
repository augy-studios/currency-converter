const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'bot.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS preferences (
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    PRIMARY KEY (user_id, code)
  );

  CREATE TABLE IF NOT EXISTS currencies_cache (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rates_cache (
    base TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Persists context for interactive buttons (refresh, pagination, toggles)
  -- so callback_data can stay a short opaque id that keeps working across
  -- bot restarts, instead of encoding state directly into callback_data.
  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

function ensureUser(userId) {
  db.prepare('INSERT OR IGNORE INTO users (user_id, created_at) VALUES (?, ?)').run(userId, Date.now());
}

function getPreferences(userId) {
  return db.prepare('SELECT code FROM preferences WHERE user_id = ? ORDER BY code ASC').all(userId).map((r) => r.code);
}

function hasPreference(userId, code) {
  return !!db.prepare('SELECT 1 FROM preferences WHERE user_id = ? AND code = ?').get(userId, code);
}

function togglePreference(userId, code) {
  if (hasPreference(userId, code)) {
    db.prepare('DELETE FROM preferences WHERE user_id = ? AND code = ?').run(userId, code);
    return false;
  }
  db.prepare('INSERT INTO preferences (user_id, code) VALUES (?, ?)').run(userId, code);
  return true;
}

function clearPreferences(userId) {
  db.prepare('DELETE FROM preferences WHERE user_id = ?').run(userId);
}

function getAllCurrencies() {
  return db.prepare('SELECT code, name FROM currencies_cache ORDER BY code ASC').all();
}

function currencyExists(code) {
  return !!db.prepare('SELECT 1 FROM currencies_cache WHERE code = ?').get(code);
}

function replaceCurrencies(entries) {
  const insert = db.prepare('INSERT INTO currencies_cache (code, name) VALUES (?, ?)');
  const tx = db.transaction((rows) => {
    db.prepare('DELETE FROM currencies_cache').run();
    for (const [code, name] of rows) insert.run(code, name);
  });
  tx(entries);
}

function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

function getRatesCache(base) {
  return db.prepare('SELECT date, data, fetched_at FROM rates_cache WHERE base = ?').get(base);
}

function setRatesCache(base, date, data) {
  db.prepare(
    `INSERT INTO rates_cache (base, date, data, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(base) DO UPDATE SET date = excluded.date, data = excluded.data, fetched_at = excluded.fetched_at`
  ).run(base, date, JSON.stringify(data), Date.now());
}

function createInteraction(kind, userId, payload) {
  const info = db
    .prepare('INSERT INTO interactions (kind, user_id, payload, created_at) VALUES (?, ?, ?, ?)')
    .run(kind, userId, JSON.stringify(payload), Date.now());
  return info.lastInsertRowid;
}

function getInteraction(id) {
  const row = db.prepare('SELECT id, kind, user_id, payload FROM interactions WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, payload: JSON.parse(row.payload) };
}

function updateInteraction(id, payload) {
  db.prepare('UPDATE interactions SET payload = ? WHERE id = ?').run(JSON.stringify(payload), id);
}

// Housekeeping: drop interaction rows older than 180 days so the table
// does not grow forever. Buttons on very old messages simply stop working,
// which matches Telegram's own behaviour of edited/aged-out messages.
function pruneOldInteractions() {
  const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM interactions WHERE created_at < ?').run(cutoff);
}

module.exports = {
  db,
  ensureUser,
  getPreferences,
  hasPreference,
  togglePreference,
  clearPreferences,
  getAllCurrencies,
  currencyExists,
  replaceCurrencies,
  getMeta,
  setMeta,
  getRatesCache,
  setRatesCache,
  createInteraction,
  getInteraction,
  updateInteraction,
  pruneOldInteractions,
};
