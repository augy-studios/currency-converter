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


# Same as safe_edit, but for editing a message located via (chat_id, message_id)
# rather than from the event that produced it — needed when the message being
# updated (e.g. a graph photo) is edited in response to a *different* event,
# such as a plain-text reply consumed by src/handlers/message.py.
async def safe_edit_message(client, chat_id, message_id, *args, **kwargs):
    try:
        await client.edit_message(chat_id, message_id, *args, **kwargs)
    except MessageNotModifiedError:
        pass
