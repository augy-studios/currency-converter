# Genuine Telegram Rich Messages (headings, tables, lists) via raw TL requests.
#
# Telethon's high-level send_message/edit_message never populate the
# `rich_message` field, so structured replies go through the raw
# messages.SendMessage / EditMessage / EditInlineBotMessage requests here.
#
# Contract: every builder that produces structured content returns
#     rich = {'markdown': <Rich Markdown string>, 'fallback': <plain text>}
# `fallback` is what goes in the request's required `message=` field - old
# clients show it, and it is what we send if the rich payload is rejected.
# No parse_mode anywhere in this module: the fallback is plain text.
from telethon import types
from telethon.errors import MessageNotModifiedError
from telethon.tl import functions


def _rich_markdown(rich):
    return types.InputRichMessageMarkdown(markdown=rich['markdown'])


# Editing without reply_markup keeps the old keyboard; an empty inline
# keyboard is what actually removes it.
_NO_BUTTONS = types.ReplyInlineMarkup(rows=[])


def is_inline_callback(event):
    """True when a CallbackQuery came from an inline-mode result rather than a chat message."""
    return isinstance(event.query, types.UpdateInlineBotCallbackQuery)


def sent_message_id(result):
    """Id of the message a raw send created (bot sends come back as Updates)."""
    if isinstance(result, (types.Message, types.UpdateShortSentMessage)):
        return result.id
    for update in getattr(result, 'updates', []):
        if isinstance(update, types.UpdateMessageID):
            return update.id
        if isinstance(update, (types.UpdateNewMessage, types.UpdateNewChannelMessage)):
            return update.message.id
    return None


async def send_rich_message(client, entity, rich, buttons=None):
    markup = client.build_reply_markup(buttons) if buttons else None
    try:
        return await client(functions.messages.SendMessageRequest(
            peer=entity, message=rich['fallback'],
            rich_message=_rich_markdown(rich), reply_markup=markup))
    except Exception as err:
        print(f'[send_rich_message] rich send failed, falling back: {err}')
        return await client.send_message(entity, rich['fallback'], buttons=buttons)


async def edit_rich_message_at(client, peer, msg_id, rich, buttons=None):
    """Edit by chat + message id. No buttons => keyboard removed."""
    markup = client.build_reply_markup(buttons) if buttons else _NO_BUTTONS
    try:
        await client(functions.messages.EditMessageRequest(
            peer=peer, id=msg_id, message=rich['fallback'],
            rich_message=_rich_markdown(rich), reply_markup=markup))
    except MessageNotModifiedError:
        return
    except Exception as err:
        print(f'[edit_rich_message_at] rich edit failed, falling back: {err}')
        await client.edit_message(peer, msg_id, text=rich['fallback'], buttons=buttons)


# messages.editInlineBotMessage must be invoked from the datacenter the inline
# message lives on, otherwise Telegram answers MESSAGE_ID_INVALID and does
# nothing. This mirrors what Telethon's own edit_message() does internally.
async def _call_from_message_dc(client, msg_id, request):
    if client.session.dc_id == msg_id.dc_id:
        return await client(request)
    sender = await client._borrow_exported_sender(msg_id.dc_id)
    try:
        return await client._call(sender, request)
    finally:
        await client._return_exported_sender(sender)


async def edit_rich_message(client, event, rich, buttons=None):
    """Edit the message a CallbackQuery came from - regular chat or inline-mode."""
    markup = client.build_reply_markup(buttons) if buttons else None
    is_inline = is_inline_callback(event)
    try:
        if is_inline:
            await _call_from_message_dc(client, event.query.msg_id, functions.messages.EditInlineBotMessageRequest(
                id=event.query.msg_id, message=rich['fallback'],
                rich_message=_rich_markdown(rich), reply_markup=markup))
        else:
            await client(functions.messages.EditMessageRequest(
                peer=event.query.peer, id=event.query.msg_id, message=rich['fallback'],
                rich_message=_rich_markdown(rich), reply_markup=markup))
    except MessageNotModifiedError:
        return
    except Exception as err:
        print(f'[edit_rich_message] rich edit failed, falling back: {err}')
        if is_inline:
            await client.edit_message(event.query.msg_id, text=rich['fallback'], buttons=buttons)
        else:
            await client.edit_message(event.query.peer, event.query.msg_id,
                                      text=rich['fallback'], buttons=buttons)
