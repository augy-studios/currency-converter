from telethon.errors import MessageNotModifiedError


# Telegram rejects an edit whose text/buttons are byte-identical to what's
# already on the message (e.g. Refresh tapped when the rate hasn't moved,
# or a pagination/toggle button re-rendering the same state). That's not a
# real failure from the user's point of view, so swallow it here instead of
# letting it bubble up as an unhandled exception.
async def safe_edit(event, *args, **kwargs):
    try:
        await event.edit(*args, **kwargs)
    except MessageNotModifiedError:
        pass
