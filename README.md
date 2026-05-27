# Hot Demos

Runnable tutorial projects for [Hot](https://hot.dev).

Each directory is a standalone Hot project with its own `hot.hot`, README,
`.env.example`, source, and tests. You can clone one demo without cloning the
others.

## Demos

| Project            | What it is                                                                 |
|--------------------|----------------------------------------------------------------------------|
| `hot-chat`         | **Start here.** Next.js chat UI plus TeamAgent and PersonalAgent in one `hot dev` |
| `slack-bot`        | multi-provider AI Slack bot (Claude / GPT / Grok / Gemini), polling-in-dev / webhooks-in-prod |
| `my-news`          | scheduled job that summarizes AI news with Claude and emails via Resend    |
| `graph-rag-memory` | graph-RAG memory primitives and hybrid retrieval (function-driven)         |

The Hot Chat walkthrough lives in the main Hot docs at
[/docs/demos/hot-chat](https://hot.dev/docs/demos/hot-chat). The
[Agent Graph conventions](./docs/agent-graph.md) are also worth a quick read
before you wire up a new agent.

## Run A Demo

```bash
cd hot-chat
hot dev --open
```

Run tests:

```bash
hot test
```

## Context Variables

Some demos include `hot/ctx.hot` as a local-development convenience for
bridging values from `.env` into Hot context variables. Hot Dev Cloud ignores
`hot/ctx.hot`; for deployed demos, add the same context variables in the Hot
Dev App at [app.hot.dev](https://app.hot.dev) instead.

## CI

The GitHub Actions workflow installs the latest Hot CLI with
`hot-dev/setup-hot` and runs:

- `hot test` in each Hot project demo,
- `npm ci && npm run build` in `hot-chat`.
