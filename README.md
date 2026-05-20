# Hot Demos

Runnable tutorial projects for [Hot](https://hot.dev).

Each directory is a standalone Hot project with its own `hot.hot`, README,
`.env.example`, source, and tests. You can clone one demo without cloning the
others.

## Demos

| Project           | What it is                                                        |
|-------------------|-------------------------------------------------------------------|
| `my-news`         | newsletter workflow demo                                          |
| `slack-bot`       | Slack bot workflow demo                                           |
| `team-agent`      | multi-transport team memory agent (web transport in this demo)    |
| `personal-agent`  | identity-first personal memory agent                              |
| `graph-rag-memory`| graph-RAG memory primitives and hybrid retrieval                  |
| `hot-chat`        | local Next.js web chat client for TeamAgent and PersonalAgent     |

The full walkthroughs live in the main Hot docs under `/docs/demos`. The
[Agent Graph conventions](./docs/agent-graph.md) are also worth a quick read
before you wire up a new agent.

## Run A Demo

```bash
cd team-agent
hot dev --open
```

Run tests:

```bash
hot test
```

## Package Dependencies

Demos prefer published Hot packages so they work for new users with a
standard Hot installation.

A few demos currently depend on unreleased `hot-ai` and `hot-ai-agent`
features. Those demos use local package paths by default and accept
environment variable overrides:

```bash
HOT_AI_PATH=/path/to/hot/hot/pkg/hot-ai \
HOT_AI_AGENT_PATH=/path/to/hot/hot/pkg/hot-ai-agent \
hot test
```

The default layout assumes this repository and the main `hot` repository are
sibling checkouts:

```text
hot-dev/
  hot/
  hot-demos/
```

After publishing, replace local entries in each demo's `hot.hot` with
versioned coordinates (e.g. `"hot.dev/hot-ai-agent": "0.1.0"`).

## CI

The GitHub Actions workflow installs the latest Hot CLI with
`hot-dev/setup-hot`, checks out the main `hot` repository for the temporary
local package overrides, and runs:

- `hot test` in each Hot project demo,
- `npm ci && npm run build` in `hot-chat`.
