// Tracks users who ran /rate and are expected to send a bare base currency
// next. Intentionally in-memory only: losing this on restart just means the
// user re-runs /rate, which is a fine degradation for a short text prompt.
const pending = new Set();

module.exports = {
  mark(userId) {
    pending.add(userId);
  },
  consume(userId) {
    if (!pending.has(userId)) return false;
    pending.delete(userId);
    return true;
  },
};
