# Agent Graph Expectations

Hot's Agent Graph is generated from metadata and code that the compiler can
understand:

- `meta {agent: AgentType}` groups handlers under an agent.
- `meta {on-event: "event:name"}` creates event handler nodes.
- literal `send("event:name", data)` calls create outgoing event edges.
- `meta {sends: [...]}` documents edges that are hidden behind helpers,
  adapters, dynamic event names, or package-level functions.

Use literal `send(...)` calls when the event name is static and visible in the
app code. Add `sends` metadata when a transport adapter or reusable helper hides
the effective event edge from the compiler.

## Demo Expectations

`hot-chat` ships two agents (`team-agent`, `personal-agent`) that share
the same per-command event pattern. Each slash command is one `on-event`
handler — no central dispatch function, no big `cond`. Both agents should
show a graph that is essentially:

- one event node per command (`personal-agent:remember`,
  `personal-agent:recall`, `team-agent:ask`, `team-agent:record`, …)
- each handler emits `<agent>:reply:start` / `:delta` / `:end` stream
  events back to the client

Add a command by writing one more `on-event` handler — the graph stays
accurate without extra wiring.

`graph-rag-memory` is memory-first rather than agent-first:

- the current demo exposes seed and query functions
- if wrapped in an agent, ingest, compaction, graph extraction, and query
  handlers should each declare `on-event`
- generated or helper-hidden event names should be declared with `sends`

The main Hot docs include walkthrough pages for each demo under
`resources/docs/demos`.
