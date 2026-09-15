# Tracks users who have a /setpreferred menu open, so currency codes they type
# in that chat are added to their preferred list without scrolling the paged
# keyboard. Unlike pending_rate / pending_graph_add this is not one-shot: the
# mode stays active until ✅ Done is tapped (or a newer menu replaces it).
# In-memory only, same rationale as the others: after a restart the buttons
# still work, and re-running /setpreferred re-arms typing.
_pending = {}


def mark(user_id, interaction_id):
    _pending[user_id] = interaction_id


def peek(user_id):
    return _pending.get(user_id)


# Clears the mode. Pass interaction_id to only clear if that menu is the active
# one — tapping Done on an older menu shouldn't disarm a newer one.
def clear(user_id, interaction_id=None):
    if interaction_id is None or _pending.get(user_id) == interaction_id:
        _pending.pop(user_id, None)
