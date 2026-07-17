# Tracks users who tapped "Add currency" on a graph and are expected to send
# a bare currency code next. Intentionally in-memory only, same rationale as
# pending_rate.py: losing this on restart just means the user taps the button
# again, a fine degradation for a short text prompt.
_pending = {}


def mark(user_id, interaction_id):
    _pending[user_id] = interaction_id


def consume(user_id):
    return _pending.pop(user_id, None)
