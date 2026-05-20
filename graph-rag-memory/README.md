# Graph-RAG Memory Demo

This demo shows the memory layer that sits behind every Hot agent: raw
records, compacted capsules, graph nodes/edges, hybrid retrieval, and
provenance-preserving citations. There are no transport adapters here — it's
a pure walkthrough of how memory accumulates and is queried.

## What This Demo Teaches

- write raw session memory,
- compact a window into a durable capsule,
- store extracted graph nodes and edges with provenance,
- run hybrid recall that combines vector hits and graph expansion,
- get back citations that link the answer to source memory.

## Dependencies

Until the graph helpers ship in `hot-ai`, this demo uses a local package
path:

```hot
"hot.dev/hot-ai": { "local": "../../hot/hot/pkg/hot-ai" }
```

Override it if your checkout layout is different:

```bash
HOT_AI_PATH=/path/to/hot/hot/pkg/hot-ai hot test
```

After publishing, replace the local entry with the published version.

## Tutorial

### Step 1: Verify Prerequisites

Install the Hot CLI and confirm `hot dev` works. Keep the main `hot`
repository as a sibling of this one:

```text
hot-dev/
  hot/
  hot-demos/
```

No LLM or external API key is required. Without an embedding provider, the
demo falls back to graph expansion so you still see citations.

### Step 2: Configure

```bash
cp .env.example .env
```

If your repos aren't siblings:

```bash
export HOT_AI_PATH=/path/to/hot/hot/pkg/hot-ai
```

### Step 3: Run The Tests

```bash
hot test
```

You should see three tests pass. `test-hybrid-query-has-citations` is the
one that exercises the no-embedding fallback path.

### Step 4: Start Hot Dev (Optional)

```bash
hot dev --open
```

This demo is function-driven — you'll exercise it through `hot eval`. Keep
Hot Dev running if you want to inspect the project source in the App.

### Step 5: Seed Memory

The single quotes are important — `::` and `/` are Hot syntax and your
shell must pass them through unchanged.

```bash
hot eval '::graph-rag-memory::demo/seed-demo()'
```

Expected result:

```text
{records: 3, capsules: 1, nodes: 5, edges: 4}
```

That's 3 raw records, 1 capsule compacted from those records, plus 5
entities (people, projects, tasks) connected by 4 edges.

### Step 6: Run A Hybrid Query

```bash
hot eval '::graph-rag-memory::demo/query("What blocks TeamAgent launch readiness?")'
```

Expected result (counts vary by embedding configuration):

```text
{
  vector-count: 0..3,
  edge-count: 4,
  citation-count: 4..7,
  citations: [
    {id: "edge:team-agent-docs", label: "TeamAgent blocked-by Docs walkthrough", excerpt: "…"},
    …
  ]
}
```

`vector-count` may be `0` if no embedding provider is configured. The graph
edges and citations are still returned, so the answer structure is visible.

### Step 7: Trace The Code

Open `hot/src/graph-rag-memory/demo.hot` and follow the four functions:

- `seed-records` writes raw messages.
- `seed-capsule` compacts those records into a durable capsule.
- `seed-graph` extracts nodes and edges, attaching provenance back to the
  source record.
- `query` runs hybrid recall and falls back to graph expansion if the
  embedding call fails.

The interesting bit is **provenance**: every node, edge, and citation knows
which record it came from, so the agent layer can cite memory back to its
source.

## Agent Graph Walkthrough

This demo is intentionally memory-centric, so it doesn't declare an `agent`
type or webhook. If you wrap these functions in an agent later:

- put `on-event` metadata on ingest, compaction, extraction, and query
  handlers,
- prefer literal `send(...)` calls — the compiler picks them up
  automatically,
- declare any helper-hidden event names with `meta {sends: …}`.
