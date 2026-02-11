# Slack Bot Demo

> **Tutorial:** [Build an AI Slack Bot with Claude, GPT, Grok, & Gemini](https://hot.dev/blog/build-ai-slack-bot) — full step-by-step guide on the Hot Dev Blog.

An AI-powered Slack bot built entirely in Hot. Responds to messages in a dedicated channel with AI-generated replies, threaded for clean conversation flow.

**Dual-mode architecture:** uses polling in local development and real-time Slack Events API webhooks in production.

## Features

- **Multi-provider AI**: Switch providers and models live in Slack — `!ai haiku`, `!ai gpt-4o-mini`, `!ai grok`, `!ai gemini-2.5-pro`
- **Dual-mode**: Polling (local dev) ↔ Webhooks (production)
- **Thread replies**: Keeps the channel clean with threaded responses
- **Signature verification**: Validates Slack webhook signatures in production

## Quick Start

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Add **Bot Token Scopes** under OAuth & Permissions:
   - `channels:history` — read messages from public channels
   - `channels:read` — get channel info
   - `chat:write` — post messages
   - `groups:history` — read messages from private channels *(optional)*
   - `im:history` — read direct messages *(optional)*
4. Install the app to your workspace
5. Copy the **Bot User OAuth Token** (`xoxb-...`)
6. Invite the bot to a channel: `/invite @YourBotName`

### 2. Run the Dev Server

```bash
cd demos/slack-bot
hot dev --open
```

This starts the Hot Dev runtime locally and opens the app in your browser at `http://localhost:4680`.

### 3. Set Context Variables

Hot Dev uses **context variables** for configuration and secrets. In the local Hot Dev App, go to **Context Variables** and set:

| Key | Value |
|-----|-------|
| `slack.api.key` | Your Bot User OAuth Token (`xoxb-...`) |
| `slack.channel.id` | The channel ID (`C...`) |
| `anthropic.api.key` | Your Anthropic API key |

If you're using a different default AI provider, set that provider's key instead (e.g., `openai.api.key`, `xai.api.key`, or `gemini.api.key`).

### 4. Test It

The bot polls the channel every 2 minutes for new messages. Trigger an immediate check:

```bash
hot eval 'send("slack-bot:check")'
```

Type a message in your Slack channel and wait for the bot to reply.

### 5. Deploy to Production

To deploy to [Hot Dev Cloud](https://hot.dev), you need an API key:

1. Create an account at [app.hot.dev](https://app.hot.dev)
2. Go to **API Keys** and create a new key
3. Set it in your terminal or in a `.env` file in the project root:

```bash
export HOT_API_KEY=your-api-key-here
```

Set context variables at [app.hot.dev](https://app.hot.dev) → **Context Variables** — the same keys as local, plus:

- `slack.signing.secret` — your Signing Secret (under **Basic Information** in your Slack app — needed for webhook verification)

Before deploying, comment out the `schedule` line in the polling handler — webhooks handle messages in real time:

```hot
check-channel-poll
meta {
  // schedule: "every 2 minutes",  // comment out scheduled polling in Hot Dev Cloud in favor of webhooks + Slack Events API
  on-event: "slack-bot:check"
}
```

Then deploy:

```bash
hot deploy
```

Once deployed, configure the Slack Events API:

1. Go to your Slack app → **Event Subscriptions** → Enable
2. Set the **Request URL** to your webhook endpoint (find it at [app.hot.dev/webhooks](https://app.hot.dev/webhooks))
3. Subscribe to **Bot Events**:
   - `message.channels` — messages in public channels
   - `message.groups` — messages in private channels *(optional — requires `groups:history` scope)*
   - `message.im` — direct messages to the bot *(optional — requires `im:history` scope)*
4. Save changes — Slack will prompt you to reinstall the app to pick up the new event permissions.

> **Note:** Subscribing to an event locks its required scope — you won't be able to remove the scope until you remove the event subscription first.

## Switching AI Providers

Type `!ai` commands directly in the Slack channel — pick a provider or a specific model:

| Command | Model |
|---------|-------|
| `!ai` | Show current model and all options |
| `!ai claude` or `sonnet` | claude-sonnet-4-5 |
| `!ai opus` | claude-opus-4-6 |
| `!ai gpt` or `gpt-5.2` | gpt-5.2 |
| `!ai gpt-mini` | gpt-5-mini |
| `!ai grok` | grok-4-1-fast |
| `!ai gemini` | gemini-3-flash-preview |

The bot scans the last 100 messages for the most recent `!ai` selection and uses that provider + model for all subsequent replies. If none found, defaults to Claude Sonnet.

The selection persists in the channel's chat history — no external state needed.

## Architecture

```
Local Dev (polling):                    Production (webhooks):

  Schedule (every 2 min)                  Slack Events API
         │                                       │
         ▼                                       ▼
  check-channel-poll()               on-slack-event(request)
         │                                       │
         ├─ scheduled poll                    ├─ verify signature
         ├─ auth.test → bot user ID              ├─ URL verification challenge
         ├─ conversations.history                ├─ parse event
         ├─ filter own/system msgs               ├─ skip bot messages
         └─ for each message:                    └─ handle-message()
              └─ handle-message()                      │
                       │                               │
                       ├─ !ai command?                 ├─ !ai command?
                       │   ├─ !ai → show providers     │   ├─ !ai → show providers
                       │   └─ !ai gpt → ack switch     │   └─ !ai gpt → ack switch
                       │                               │
                       └─ regular message?             └─ regular message?
                           ├─ detect-provider()            ├─ detect-provider()
                           │   (scan last 100 msgs)        │   (scan last 100 msgs)
                           ├─ ask-ai(provider)             ├─ ask-ai(provider)
                           └─ reply in thread              └─ reply in thread
```

## How Dual-Mode Works

The bot supports two modes:

- **Local dev** (`hot dev`): The scheduled poll runs every 2 minutes, fetches recent messages, and replies
- **Production** (`hot deploy`): The webhook endpoint receives real-time events from Slack's Events API

For production, comment out the `schedule` line in the polling handler before deploying — webhooks handle messages in real time, so polling isn't needed.

## Default Model

If you want to change the fallback (when no `!ai` command is found in history), edit one line in `bot.hot`:

```hot
DEFAULT_SELECTION {service: "Anthropic", model: "claude-sonnet-4-5"}
```

Make sure the corresponding API key is set in your context variables.
