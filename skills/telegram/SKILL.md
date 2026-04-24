---
name: telegram
description: 'Interact with Telegram — send messages, read chat history, get updates, manage chats, forward messages, send media. Use this skill whenever the user mentions Telegram, TG, Telegram bot, wants to send a Telegram message, read Telegram chats, check Telegram updates, manage Telegram channels/groups, or interact with Telegram bots. Also trigger when the user mentions a Telegram bot token, chat ID, or wants to automate Telegram messaging.'
---

# Telegram

Send messages, read chat history, get updates, manage chats, forward messages, and send polls via the Telegram Bot API.

## Authentication

Use `sig run` to inject the bot token as an environment variable. The shared `telegram_client.py` reads `SIG_TELEGRAM_TOKEN` from the environment, or you can pass `--token` directly.

```bash
sig run telegram -- python scripts/tg_send.py --chat-id 123456 --text "Hello"
```

The default provider is `telegram`. The env var name follows the rule: `SIG_<PROVIDER>_TOKEN` where `<PROVIDER>` is the provider name uppercased.

If you get an auth error:

```bash
sig login telegram
```

Then retry the `sig run` command.

## Setup

Obtain a bot token from [@BotFather](https://t.me/BotFather) on Telegram. The token format is `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`.

To configure `telegram` as a provider, run:

```bash
sig init
```

## Scripts Reference

All scripts are in this skill's `scripts/` directory. Run via Bash tool.

| Script           | Purpose                     |
| ---------------- | --------------------------- |
| `tg_send.py`     | Send a text message         |
| `tg_messages.py` | Get recent messages/updates |
| `tg_chat.py`     | Get chat info               |
| `tg_forward.py`  | Forward a message           |
| `tg_me.py`       | Get bot info                |
| `tg_poll.py`     | Send a poll                 |
| `tg_manage.py`   | Delete/pin/unpin messages   |

### tg_send.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--chat-id ID          Target chat ID (required)
--text TEXT            Message text (required)
--parse-mode MODE     html or markdown (optional)
--reply-to ID         Reply to a message ID (optional)
--silent              Send without notification
```

### tg_messages.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--limit N             Max messages to return (default: 20)
--offset N            Update offset for pagination (optional)
```

### tg_chat.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--chat-id ID          Chat ID (required)
```

### tg_forward.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--chat-id ID          Destination chat ID (required)
--from-chat-id ID     Source chat ID (required)
--message-id ID       Message ID to forward (required)
--silent              Forward without notification
```

### tg_me.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
```

### tg_poll.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--chat-id ID          Target chat ID (required)
--question TEXT        Poll question (required)
--options OPT1,OPT2   Comma-separated options (required)
--anonymous           Make poll anonymous
--type TYPE           regular or quiz (default: regular)
```

### tg_manage.py

```
--token TOKEN         Bot token (or set SIG_TELEGRAM_TOKEN)
--chat-id ID          Chat ID (required)
--message-id ID       Message ID (required)
--action ACTION       delete, pin, or unpin (required)
```

## Key Concepts

**Bot tokens** — Obtained from @BotFather. Format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`. Keep them secret.

**Chat IDs** — Numeric identifiers for chats. Can be positive (user/group) or negative (supergroup/channel). Use `tg_messages.py` to discover chat IDs from incoming messages.

**Update offsets** — The `last_update_id` returned by `tg_messages.py` can be incremented by 1 and passed as `--offset` to get only newer updates.

**Parse modes** — Use `html` for HTML formatting or `markdown` for Markdown formatting in messages.

## Error Handling

| Error             | Cause                      | Fix                             |
| ----------------- | -------------------------- | ------------------------------- |
| UNAUTHORIZED      | Invalid bot token          | Check token with `tg_me.py`     |
| BAD_REQUEST       | Invalid parameters         | Check chat ID, message ID, etc. |
| FORBIDDEN         | Bot blocked or not in chat | Add bot to chat or unblock      |
| NOT_FOUND         | Chat or message not found  | Verify the chat/message ID      |
| TOO_MANY_REQUESTS | Rate limited               | Wait and retry                  |

## Workflow Examples

### Send a message

1. `sig run telegram -- python scripts/tg_send.py --chat-id 123456 --text "Hello!"`
2. With formatting: `sig run telegram -- python scripts/tg_send.py --chat-id 123456 --text "<b>Bold</b>" --parse-mode html`

### Check for new messages

1. `sig run telegram -- python scripts/tg_messages.py --limit 10`
2. Get newer updates: `sig run telegram -- python scripts/tg_messages.py --offset 123456790`

### Get chat info

1. `sig run telegram -- python scripts/tg_chat.py --chat-id -1001234567890`

### Forward a message

1. `sig run telegram -- python scripts/tg_forward.py --chat-id 123456 --from-chat-id 789012 --message-id 42`

### Send a poll

1. `sig run telegram -- python scripts/tg_poll.py --chat-id 123456 --question "Favorite color?" --options "Red,Blue,Green"`

### Delete a message

1. `sig run telegram -- python scripts/tg_manage.py --chat-id 123456 --message-id 42 --action delete`
