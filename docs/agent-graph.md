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

`team-agent` should show the richest graph:

- `on-web-message` as the webhook trigger
- `process-incoming` sends to `team-agent:record` and `team-agent:ask`
- `remember-message` handles `team-agent:record`
- `answer-question` handles `team-agent:ask`

`personal-agent` is intentionally smaller:

- `on-web-message` is the primary trigger
- command handling is direct, so there are no event fan-out edges yet
- future command events should use `on-event` plus `sends`

`graph-rag-memory` is memory-first rather than agent-first:

- the current demo exposes seed and query functions
- if wrapped in an agent, ingest, compaction, graph extraction, and query
  handlers should each declare `on-event`
- generated or helper-hidden event names should be declared with `sends`

The main Hot docs include walkthrough pages for each demo under
`resources/docs/demos`.
