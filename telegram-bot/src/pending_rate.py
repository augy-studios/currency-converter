# Tracks users who ran /rate and are expected to send a bare base currency
# next. Intentionally in-memory only: losing this on restart just means the
# user re-runs /rate, which is a fine degradation for a short text prompt.
_pending = set()


def mark(user_id):
    _pending.add(user_id)


def consume(user_id):
    if user_id not in _pending:
        return False
    _pending.discard(user_id)
    return True
