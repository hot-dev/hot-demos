# Hot Chat

Hot Chat is a complete, runnable demo of two AI agents and a polished web UI
that drives them — all in one Hot project. It's the demo to point at when
someone asks *"what does a product on Hot look like?"* — the culmination of
several Hot Dev platform features that combine into a powerful solution for
AI-driven products.

- **PersonalAgent** — identity-first memory. `/remember`, `/recall`,
  `/brief`, `/tasks`. Memory is keyed by *user*; the same person sees
  their notes across sessions and devices.
- **TeamAgent** — session-first memory. `/ask`, `/summary`,
  `/decisions`. Memory is keyed by *channel*; two people in the same
  chat share one view.
- **Next.js client (this app)** — a thin transport that publishes one
  typed event per message and renders the agent's reply over the run
  stream. Each slash command is its own `on-event` handler — no central
  dispatch function, no big `cond`.

Both agents live under `hot/src/` in this project and boot together with
one `hot dev`. The Next.js side is a thin transport — the agent is the
product.

> **Note:** This demo has been improved since the original
> [blog post](https://hot.dev/blog/build-ai-agents) and
> [video](https://www.youtube.com/watch?v=WubNrFsbC5U) to support OpenAI for
> both the LLM and embeddings. Using OpenAI embeddings avoids the video step
> where the default embedder downloads a local model. Your choice.

## What You'll Need

- **Hot CLI** — [hot.dev/download](https://hot.dev/download)
- **Node 20+** for the Next.js app
- **A Hot API key** for your local dev environment (one-time, see below)
- No LLM API keys are required to launch the UI. Add `ANTHROPIC_API_KEY` or
  `OPENAI_API_KEY` for live streamed replies; without one, LLM-backed commands
  use a deterministic offline stub.

## Run It

Two terminals.

```bash
# terminal 1 — both agents
hot dev --open
```

`hot dev` opens the Hot App at <http://localhost:4681> and registers both
agents under one project. Leave it running.

While the Hot App is open, generate an API key:

> *Hot App → API Keys → New Key.* Copy the value.

```bash
# terminal 2 — chat UI
cp .env.example .env
# paste the API key into HOT_API_KEY in .env
npm install
npm run dev
```

Open <http://localhost:3000>. The toolbar switches between Personal and
Team modes live.

## Suggested Walkthrough

1. **Personal Mode.** Type `/remember I prefer launch updates that start
   with blockers` and press Enter — you'll see `remembered` stream into
   the assistant bubble. Click **Recall preferences** (a quick-prompt
   chip) — the matching note comes back. Refresh the browser; ask
   `/recall` again. Same answer, because memory is keyed on you, not on
   the chat session.
2. **Switch to Team Mode.** Type *"we decided to ship docs before
   launch"*, then *"CI is the only blocker"*. With an Anthropic or OpenAI key
   configured, `/ask what is blocking launch?` streams a grounded reply that
   cites the matching record with attribution. Without a key, the command takes
   the same path up to the LLM call and then returns the offline stub.
3. **Drag a file in.** Drop a small `notes.md` or `screenshot.png` (under
   4 MB) onto the chat. A chip appears below the composer; the next
   reply notes how many attachments were carried.
4. **Inspect identity.** Click *Identity* in the toolbar. You'll see the
   exact `session_id` and `user_id` the agent is receiving —
   `person:<uuid>` in Personal Mode (memory follows the person),
   `web:chat:<uuid>` in Team Mode (memory follows the chat). Identity is
   `localStorage`-only.
5. **Open the Agent Graph.** In the Hot App, click into either agent and
   open *Agent Graph*. Each slash command shows up as its own typed
   event wired to its own handler — `team-agent:ask` to `ask-question`,
   `team-agent:record` to `record-message`, and so on.

## Layout

```text
hot-chat/
  src/                            # Next.js app
    app/api/chat/route.ts         # SSE proxy via @hot-dev/sdk/proxy
    lib/agent-client.ts           # demo command map + @hot-dev/sdk/agent
  hot.hot                         # Hot project config (one project, two agents)
  hot/
    src/
      personal-agent.hot          # per-command event handlers
      team-agent.hot              # per-command event handlers
    test/
      personal-agent.hot
      team-agent.hot
```

Both files are short, single-file agents. Diff them to see the main
architectural difference: PersonalAgent derives `session_id` from the identity;
TeamAgent trusts the caller's `session_id`. That's the identity-first /
session-first split made literal.

## Wire Contract

Hot Chat's browser code parses slash commands client-side and POSTs the
typed event to the Next.js server route, which forwards it (with the
API key) to Hot's `/v1/streams/subscribe-with-event`. The first message in a
browser chat omits `stream_id`; Hot returns one in `event:published`, and the
client reuses that stream for later messages in the same chat:

```json
{
  "event_type": "team-agent:ask",
  "event_data": {
    "session_id":  "web:chat:<uuid>",
    "user_id":     "web:user:<uuid>",
    "user_name":   "Demo User",
    "message_id":  "web:<chat-id>:<timestamp>",
    "timestamp":   1700000000,
    "question":    "what's blocking launch?",
    "attachments": [{"name": "notes.md", "type": "text/markdown", "size": 412, "text": "…"}],
    "metadata":    {"client": "hot-chat", "target": "team-agent"}
  },
  "stream_id": "optional-existing-stream-uuid"
}
```

The agent's matching `on-event` handler runs and emits
`team-agent:reply:start` / `:delta` / `:end` stream events. The browser reads
those and renders the assistant message as it arrives. A Slack or Telegram
adapter can publish the same events from native message shapes.

## Environment

```bash
HOT_API_URL=http://localhost:4681          # Hot runtime
HOT_API_KEY=<api key>                      # server-side only
HOT_AGENT_TARGET=personal-agent            # default agent on first load
HOT_CHAT_PROVIDER=auto                     # auto, anthropic, or openai
HOT_CHAT_MODEL=                            # optional; e.g. claude-sonnet-4-5 or gpt-4o-mini
ANTHROPIC_API_KEY=                         # optional; required for Anthropic chat
OPENAI_API_KEY=                            # optional; required for OpenAI chat and/or embeddings
HOT_CHAT_EMBEDDING_PROVIDER=               # optional; set to openai for OpenAI embeddings
```

The browser calls Next.js's `/api/chat` route; only the server route holds
`HOT_API_KEY`, exactly the way every Next.js app keeps a `DATABASE_URL`
out of the browser.

Chat and embeddings are configured independently. `HOT_CHAT_PROVIDER=auto`
infers the chat provider from `HOT_CHAT_MODEL` when set, otherwise it uses an
available Anthropic or OpenAI key. Memory search uses `::hot::store` embeddings;
leave `HOT_CHAT_EMBEDDING_PROVIDER` unset for the default embedding path, or set
`HOT_CHAT_EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY` to use
`::openai::embeddings/create` as `embed-fn` / `embed-batch-fn`.

`hot/ctx.hot` is a local development convenience: `hot dev` uses it to bridge
`.env` values like `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` into the
`::hot::ctx` keys that provider adapters read. Hot Cloud does not run
`hot/ctx.hot`; when deploying this demo, set these Context Variables on the
application instead:

```text
anthropic.api.key   # required for Anthropic chat
openai.api.key      # required for OpenAI chat and/or OpenAI embeddings
```

## Local SDK development

Hot Chat depends on [`@hot-dev/sdk`](https://www.npmjs.com/package/@hot-dev/sdk) (`^1.1.0`).
Normal installs use the published npm package:

```bash
npm install
```

When you need to test local SDK changes before publishing, link your local build
with **pnpm link**:

```bash
# from hot-demos/hot-chat (requires hot-js as sibling: hot-dev/hot-js)
npm run link:sdk            # builds + pnpm-links ../../hot-js/packages/sdk
npm run dev:linked
```

After SDK edits:

```bash
cd ../../hot-js/packages/sdk && pnpm build
npm run dev:linked          # restart Next
```

**Note:** While the SDK is linked, use `dev:linked` / `build:linked`.
Those scripts enable `--webpack` because Turbopack does not resolve
pnpm-linked packages outside the project root. Use the normal `dev` / `build`
scripts once `@hot-dev/sdk` is installed from npm.

Alternative (global link, requires `pnpm setup` once):

```bash
cd hot-js/packages/sdk && pnpm build && pnpm link --global
cd hot-demos/hot-chat && pnpm link --global @hot-dev/sdk
```

## Forking An Agent

Want to ship just one mode into your own project?

1. Copy `hot/src/<agent>.hot` into your Hot project's `hot/src/`.
2. Copy `hot/test/<agent>.hot` into your `hot/test/`.
3. Add the deps to your `hot.hot`:

   ```hot
   "hot.dev/hot-ai":       "1.7.0",
   "hot.dev/hot-ai-agent": "1.3.0",
   "hot.dev/openai":       "1.2.1",
   "hot.dev/anthropic":    "1.2.1",
   ```

4. Rename the namespace in the source file to your agent's namespace
   (e.g. `::personal-agent` → `::my-app`).
5. Swap the system prompt, the commands, and the storage policy. Keep
   the transport / runtime / stream helpers — that's what `hot-ai-agent`
   is for.

For richer reference implementations, see the full TeamAgent and
PersonalAgent in the main Hot repo (`hot/hot/src/team-agent/`,
`hot/hot/src/personal-agent/`) — they add `/forget`, `/why`, `/export`,
`/compact`, `/search`, scheduled digests, a `Researcher` peer, and more.

## Verification

The Next.js side has its own build check:

```bash
npm run build
```

The agent side runs as a normal Hot project:

```bash
hot test
```
