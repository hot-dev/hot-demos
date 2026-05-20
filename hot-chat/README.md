# Hot Chat

Hot Chat is a complete, runnable demo of two AI agents and a polished web UI
that drives them — all in one Hot project.

- **PersonalAgent** — identity-first memory. `/remember`, `/recall`, `/brief`,
  `/export`. Memory is keyed by *user*; the same person sees their notes
  across sessions.
- **TeamAgent** — session-first memory. `/ask`, `/summary`, `/decisions`,
  `/memory`. Memory is keyed by *channel*; two people in the same chat share
  one view.
- **Hot Chat (this app)** — a Next.js client that publishes one typed event
  per message and renders the agent's reply over the run stream. Each
  command is its own event handler in the agent — no central dispatch
  function, no big cond.

Both agents live under `hot/src/` in this project and boot together with one
`hot dev`. The Next.js side is a thin transport — the agent is the product.

## What You'll Need

- **Hot CLI** — [hot.dev/download](https://hot.dev/download)
- **Node 20+** for the Next.js app
- **A Hot service key** for your local dev environment (one-time, see below)
- No LLM API keys — the demo agents answer from local memory.

## Run It

Two terminals.

```bash
# terminal 1 — both agents
hot dev --open
```

`hot dev` opens the Hot App at <http://localhost:4681> and registers both
agents under one project. Leave it running.

While the Hot App is open, generate a service key:

> *Hot App → Service Keys → New Key.* Copy the value.

```bash
# terminal 2 — chat UI
cp .env.example .env
# paste the service key into HOT_API_KEY in .env
npm install
npm run dev
```

Open <http://localhost:3000>. The toolbar switches between PersonalAgent and
TeamAgent live.

## Suggested Walkthrough

1. **PersonalAgent.** Type `/remember I prefer launch updates that start with
   blockers` and press Enter — you'll see `remembered` stream into the
   assistant bubble. Click **Recall preferences** (a quick-prompt chip) —
   the matching note comes back. Refresh the browser; ask `/recall` again.
   Same answer, because memory is keyed on you, not on the chat session.
2. **Switch to TeamAgent.** Type *"we decided to ship docs before launch"*,
   then *"CI is the only blocker"*. Now `/ask what is blocking launch?` —
   the reply cites the matching record with attribution.
3. **Drag a file in.** Drop a small `notes.md` or `screenshot.png` (under
   4 MB) onto the chat. A chip appears below the composer; the next reply
   notes how many attachments were carried.
4. **Inspect identity.** Click *Identity* in the toolbar. You'll see the
   exact `session_id` and `user_id` the agent is receiving — `person:<uuid>`
   for PersonalAgent (memory follows the person), `web:chat:<uuid>` for
   TeamAgent (memory follows the chat). Identity is `localStorage`-only.
5. **Open the Agent Graph.** In the Hot App, click into either agent and
   open *Agent Graph*. Each slash command shows up as its own typed event
   wired to its own handler — `team-agent:ask` to `ask-question`,
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

Both files are short, single-file agents. Diff them to see the
*one* line of structural difference: PersonalAgent derives `session_id`
from the identity; TeamAgent trusts the caller's `session_id`. That's the
identity-first / session-first split made literal.

## Wire Contract

Hot Chat's browser code parses slash commands client-side and POSTs the
typed event to the Next.js server route, which forwards it (with the
service key) to Hot's `/v1/streams/subscribe-with-event`:

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
  }
}
```

The agent's matching `on-event` handler runs and emits
`team-agent:reply:start` / `:delta` / `:end` stream events. The browser reads
those and renders the assistant message as it arrives. A Slack or Telegram
adapter can publish the same events from native message shapes.

## Environment

```bash
HOT_AGENT_BASE_URL=http://localhost:4681   # Hot runtime
HOT_API_KEY=<service key>                  # server-side only
HOT_AGENT_TARGET=personal-agent            # default agent on first load
```

The browser calls Next.js's `/api/chat` route; only the server route holds
`HOT_API_KEY`, exactly the way every Next.js app keeps a `DATABASE_URL`
out of the browser.

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

Want to ship just PersonalAgent (or just TeamAgent) into your own project?

1. Copy `hot/src/<agent>.hot` into your Hot project's `hot/src/`.
2. Copy `hot/test/<agent>.hot` into your `hot/test/`.
3. Add the deps to your `hot.hot`:

   ```hot
   "hot.dev/hot-ai":       "1.4.0",
   "hot.dev/hot-ai-agent": "1.0.0",
   "hot.dev/anthropic":    "1.2.1",
   ```

4. Rename the namespace in the source file to your agent's namespace (e.g.
   `::personal-agent` → `::my-app`).
5. Swap the system prompt, the commands, and the storage policy. Keep the
   transport / runtime / stream helpers — that's what `hot-ai-agent` is for.

## Verification

The Next.js side has its own build check:

```bash
npm run build
```

The agent side runs as a normal Hot project:

```bash
hot test
```
