/* Shared HMAC request-signing for UwU PWAs (client). Loaded as a plain script. */

(function () {
  const LS_KEY = 'uwu_signing_key';
  const SS_KEY = 'uwu_signing_key';
  const GUEST_TTL_MS = 10 * 60 * 1000;

  function readKey(storage) {
    let raw;
    try {
      raw = storage.getItem(LS_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        storage.removeItem(LS_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function storeSigningKey(signingKey, keyId, persistent = false, expiresAt = null) {
    const payload = JSON.stringify({ signingKey, keyId, expiresAt });
    if (persistent) {
      localStorage.setItem(LS_KEY, payload);
      sessionStorage.removeItem(SS_KEY);
    } else {
      sessionStorage.setItem(SS_KEY, payload);
      localStorage.removeItem(LS_KEY);
    }
  }

  function getSigningKey() {
    // localStorage first: a "remembered" persistent key always wins over a stale session key.
    const persisted = readKey(localStorage);
    if (persisted) return { signingKey: persisted.signingKey, keyId: persisted.keyId };
    const sessioned = readKey(sessionStorage);
    if (sessioned) return { signingKey: sessioned.signingKey, keyId: sessioned.keyId };
    return null;
  }

  function clearSigningKey() {
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_KEY);
  }

  async function initGuestKey(appId) {
    if (getSigningKey()) return; // already have a key (guest or remembered login)
    const res = await fetch(`/api/auth/guest-key?app_id=${encodeURIComponent(appId)}`);
    if (!res.ok) throw new Error('Failed to obtain guest signing key');
    const data = await res.json();
    storeSigningKey(data.signing_key, data.key_id, false, Date.now() + GUEST_TTL_MS);
  }

  async function hmacHex(key, message) {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function isEmptyBody(bodyStr) {
    return !bodyStr || bodyStr === '{}';
  }

  async function signedFetch(url, options = {}) {
    const key = getSigningKey();
    if (!key) {
      throw new Error('signedFetch: no signing key present — call initGuestKey() or storeSigningKey() first');
    }

    const method = (options.method || 'GET').toUpperCase();
    const path = new URL(url, window.location.origin).pathname;
    const ts = Date.now().toString();

    const bodyStr = options.body != null
      ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
      : '';
    const bodyHash = isEmptyBody(bodyStr) ? 'empty' : await hmacHex(key.signingKey, bodyStr);

    const message = `${ts}:${method}:${path}:${bodyHash}`;
    const token = await hmacHex(key.signingKey, message);

    const headers = new Headers(options.headers || {});
    headers.set('X-Request-Token', token);
    headers.set('X-Request-TS', ts);
    headers.set('X-Key-ID', key.keyId);

    return fetch(url, { ...options, headers });
  }

  window.storeSigningKey = storeSigningKey;
  window.getSigningKey = getSigningKey;
  window.clearSigningKey = clearSigningKey;
  window.initGuestKey = initGuestKey;
  window.signedFetch = signedFetch;
})();
