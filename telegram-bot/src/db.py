import json
import os
import sqlite3
import time

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, 'bot.db')

# Telethon runs its event loop on a single thread, but check_same_thread=False
# keeps this safe if that ever changes (e.g. running blocking DB calls in an
# executor).
_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_conn.execute('PRAGMA journal_mode = WAL')
_conn.row_factory = sqlite3.Row

_conn.executescript(
    """
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
    """
)
_conn.commit()


def ensure_user(user_id):
    _conn.execute(
        'INSERT OR IGNORE INTO users (user_id, created_at) VALUES (?, ?)',
        (user_id, int(time.time() * 1000)),
    )
    _conn.commit()


def get_preferences(user_id):
    rows = _conn.execute(
        'SELECT code FROM preferences WHERE user_id = ? ORDER BY code ASC', (user_id,)
    ).fetchall()
    return [r['code'] for r in rows]


def has_preference(user_id, code):
    row = _conn.execute(
        'SELECT 1 FROM preferences WHERE user_id = ? AND code = ?', (user_id, code)
    ).fetchone()
    return row is not None


def toggle_preference(user_id, code):
    if has_preference(user_id, code):
        _conn.execute('DELETE FROM preferences WHERE user_id = ? AND code = ?', (user_id, code))
        _conn.commit()
        return False
    _conn.execute('INSERT INTO preferences (user_id, code) VALUES (?, ?)', (user_id, code))
    _conn.commit()
    return True


def clear_preferences(user_id):
    _conn.execute('DELETE FROM preferences WHERE user_id = ?', (user_id,))
    _conn.commit()


def get_all_currencies():
    rows = _conn.execute('SELECT code, name FROM currencies_cache ORDER BY code ASC').fetchall()
    return [{'code': r['code'], 'name': r['name']} for r in rows]


def currency_exists(code):
    row = _conn.execute('SELECT 1 FROM currencies_cache WHERE code = ?', (code,)).fetchone()
    return row is not None


def replace_currencies(entries):
    _conn.execute('DELETE FROM currencies_cache')
    _conn.executemany('INSERT INTO currencies_cache (code, name) VALUES (?, ?)', entries)
    _conn.commit()


def get_meta(key):
    row = _conn.execute('SELECT value FROM meta WHERE key = ?', (key,)).fetchone()
    return row['value'] if row else None


def set_meta(key, value):
    _conn.execute(
        """INSERT INTO meta (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
        (key, value),
    )
    _conn.commit()


def get_rates_cache(base):
    row = _conn.execute(
        'SELECT date, data, fetched_at FROM rates_cache WHERE base = ?', (base,)
    ).fetchone()
    if not row:
        return None
    return {'date': row['date'], 'data': row['data'], 'fetched_at': row['fetched_at']}


def set_rates_cache(base, date, data):
    _conn.execute(
        """INSERT INTO rates_cache (base, date, data, fetched_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(base) DO UPDATE SET date = excluded.date, data = excluded.data,
               fetched_at = excluded.fetched_at""",
        (base, date, json.dumps(data), int(time.time() * 1000)),
    )
    _conn.commit()


def create_interaction(kind, user_id, payload):
    cur = _conn.execute(
        'INSERT INTO interactions (kind, user_id, payload, created_at) VALUES (?, ?, ?, ?)',
        (kind, user_id, json.dumps(payload), int(time.time() * 1000)),
    )
    _conn.commit()
    return cur.lastrowid


def get_interaction(interaction_id):
    row = _conn.execute(
        'SELECT id, kind, user_id, payload FROM interactions WHERE id = ?', (interaction_id,)
    ).fetchone()
    if not row:
        return None
    return {
        'id': row['id'],
        'kind': row['kind'],
        'user_id': row['user_id'],
        'payload': json.loads(row['payload']),
    }


def update_interaction(interaction_id, payload):
    _conn.execute(
        'UPDATE interactions SET payload = ? WHERE id = ?', (json.dumps(payload), interaction_id)
    )
    _conn.commit()


# Housekeeping: drop interaction rows older than 180 days so the table does
# not grow forever. Buttons on very old messages simply stop working, which
# matches Telegram's own behaviour of edited/aged-out messages.
def prune_old_interactions():
    cutoff = int(time.time() * 1000) - 180 * 24 * 60 * 60 * 1000
    _conn.execute('DELETE FROM interactions WHERE created_at < ?', (cutoff,))
    _conn.commit()
