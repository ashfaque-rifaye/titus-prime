# Titus-Prime · End-to-End User Journey

This document traces a complete interaction with Titus-Prime — from the
moment the LLM health check fires, through connector hydration, agent
orchestration, Ask Mode, per-agent customization, and the export of a
versioned financial codebase as a `.zip`.

> Run while reading: `npm run dev`, then open `http://localhost:8080`.

---

## 0. Boot — the LLM health check

When the server warms up, the **three-engine cascade** runs once on the first
request. It pings every provider in parallel and prints a clean ASCII block to
the terminal so you can see at a glance which engine is live.

```text
── LLM health check ──────────────────────────────────
  Gemini  ✓  1287ms  gemini-2.5-flash reachable via Google AI Studio
  Groq    ✓   468ms  llama-3.3-70b-versatile reachable via Groq
  Codex   ✗     0ms  CODEX_API_KEY missing — provider in stub mode (code is ready).
  Active  → gemini
──────────────────────────────────────────────────────
```

You can also call it on demand:

```bash
curl -s -H "Accept: application/json" http://localhost:8080/api/llm/health | jq
```

The `HealthBadge` in the top-nav polls this endpoint every 30 seconds. Click
for full diagnostics. Active engine pulses green; rose if degraded.

**Engine selection rule:**
1. honor an explicit caller-supplied engine if it's configured,
2. otherwise prefer Gemini (the documented primary),
3. otherwise Groq (fast fallback),
4. otherwise Codex (tertiary, env-gated).

If the active engine fails *before* producing any output, the request
automatically cascades to the next configured engine and a comment line
`# engine fallback: gemini → groq` is injected into the stream so the
Workshop pane shows the handoff.

---

## 1. Boardroom hydration · `/app`

This is where every claim in the narrative becomes real. The page is two-pane:

```
┌──────────────── BOARDROOM (left) ─────────────────┬─── WORKSHOP (right) ───┐
│  KPI strip  · Cash · AR · AP · Subs/mo · CSV btn  │  Live Codex stream    │
│  ConnectionsPanel  (11 connectors, auto-sync)     │  Skill Library         │
│  TreasurySection   (caution banner + sweep CTA)   │                        │
│       └─ SolvencyChart (Standby vs Autopilot)     │                        │
│  AskMode           (CFO Q&A, grounded)            │                        │
│  AgentArtifact ×4  (Collection, Subscription,     │                        │
│                     Tax, Scenario)                │                        │
│  AgentArtifact ×1  (Treasury knobs)               │                        │
│  AgentConsole      (live transcript + Run All)    │                        │
│  ApprovalQueue                                    │                        │
└───────────────────────────────────────────────────┴────────────────────────┘
```

### 1.1 Auto-sync on mount

The instant the Boardroom mounts, `ConnectionsPanel` calls `POST /api/connectors/sync`.

```
ConnectionsPanel mounts
  └─ POST /api/connectors/sync
       └─ src/lib/connectors/registry.ts · syncAll()
            ├─ Promise.allSettled across 11 connectors:
            │     Stripe · Plaid · Salesforce · QuickBooks ·
            │     Gmail · Outlook · Slack · Teams ·
            │     Razorpay · Tally · Zoho Books
            ├─ Each connector returns { inflows, outflows, subscriptions, banks }
            ├─ Merged into a CanonicalSnapshot
            ├─ FX conversion: every amount → amountUsd (USD + INR)
            ├─ Aggregate totals: cashUsd · arUsd · apUsd · monthlySubsUsd
            └─ Stored on globalThis.__TITUS_SNAPSHOT__
       └─ returns SyncReport { results[], snapshot }
  UI: every connector tile lights green, KPIs populate with totals
```

A representative live run after sync:

```
Connectors: 11 registered, 11 ingested deterministic data
Snapshot:   $36,455 cash · $104,413 AR · $64,791 AP · $8,725 subs/mo
Treasury:   Day-15 breach -$1,566 · Standby EOM $4,405 ·
            Autopilot EOM $59,370 · Agent value +$54,965
```

**Plaid real path:** if `PLAID_CLIENT_ID` and `PLAID_SECRET` are set in `.env`,
the Plaid connector hits `https://sandbox.plaid.com` for actual account
balances. Otherwise it returns deterministic fixtures (SVB Operating in USD +
HDFC Operations in INR).

### 1.2 Treasury Sentinel · Standby vs. Autopilot

Once the snapshot lands, the `TreasurySection` fetches `/api/treasury/projection`:

```
GET /api/treasury/projection
  └─ deriveView() reads canonical snapshot
  └─ projectCash() builds standby line:
       - opening cash ← banks total
       - outflows by day (vendor bills, payroll, GST)
       - inflows by day (25% recovery on overdue AR + MRR)
  └─ autopilot line = standby + recovered (top-2 chase) +
                              + paused (non-essential subs) +
                              + delayed vendor (smallest)
  └─ summary: { standbyEOM, autopilotEOM, agentValue, breach, recommendedScenario }
```

The `SolvencyChart` renders both lines simultaneously. The active line is solid;
the inactive line is dashed. The area between them is shaded emerald — that's
the **agent value**. A glide cursor reveals per-day microanalysis.

Two automatic markers:
- **LAG** — lowest balance on Standby (where you fail without help)
- **GAIN** — day with the largest delta vs. Standby (where the agent earns its keep)

### 1.3 Run all agents (full sweep)

Click "Run all agents" in the Treasury panel:

```
Click [Run all agents →]
  └─ POST /api/agents/run  { mode: "stream" }
       └─ runOrchestrator()       ─→ src/lib/agents/orchestrator.ts
             │
             ├─ bus.emit(run.started)
             │
             ├─ Step 1 · Treasury Sentinel runs first
             │     ├─ codex.runSkill(cash_forecast)
             │     │     ├─ getCustomization("treasury")  ← user instruction
             │     │     ├─ selectProvider() → Gemini (or cascade)
             │     │     ├─ provider.streamComplete()    ← real LLM call
             │     │     ├─ bus.emit(codex.token)        ← every token
             │     │     └─ commitSkill(...)             ← Supabase row v(n+1)
             │     ├─ inspect snapshot vs. SAFETY_FLOOR
             │     └─ if breach: bus.emit(agent.message{
             │                       from: treasury,
             │                       to:   broadcast,
             │                       subject: "ESCALATE: cash_crunch_detected",
             │                       payload: { day, shortfall }
             │                   })
             │
             ├─ Step 2 · ENTER CRISIS MODE — orchestrator broadcasts
             │
             ├─ Step 3 · Other four agents run in parallel
             │     ├─ Collection   ─→ crisis-mode prioritization
             │     ├─ Subscription ─→ crisis-mode pausable surfacing
             │     ├─ Tax          ─→ tx_saas_calc skill (independent)
             │     └─ Scenario     ─→ optimize_survival skill (only in crisis)
             │
             ├─ Step 4 · Policy Envelope evaluates every proposed action
             │     ├─ loadPolicy()    ← Supabase `policies` row
             │     ├─ evaluate(action, policy) → { decision, ruleHit }
             │     ├─ "auto"  → bus.emit(policy.decision{decision:"auto"})
             │     └─ "queue" → INSERT into approvals + bus.emit(approval.queued)
             │
             └─ bus.emit(run.completed{summary})
```

Every event is rendered in three places at once:
1. **AgentConsole** — the transcript on the left, color-coded
2. **Workshop pane** — Codex's token stream renders as a typewriter
3. **ApprovalQueue** — queued actions animate in via Supabase realtime

---

## 2. Ask Mode · grounded CFO Q&A

```
User types: "What is our biggest cash risk in the next 30 days?"
  └─ POST /api/ask  { question }
       └─ ensureSnapshot() + deriveView()  ← live ground-truth context
       └─ system prompt: strict JSON schema
            { answer: string,
              highlights: string[],
              citedFigures: [{label,value}, ...] }
       └─ provider.complete()       ← Gemini, Groq, or Codex per cascade
       └─ extractWrapper()          ← robust unwrap (handles JSON-in-JSON)
       └─ normalize highlights & citedFigures → arrays
  Response (live):
    answer       → "The biggest cash risk is the combined payroll runs
                    totaling $39,365.27 USD due in 15 days, which drives
                    the cash balance to -$1,566 by day 15..."
    highlights   → 5 bullets (Day-15 breach, $22k US payroll, ₹14.5L IN
                    payroll, safety floor breach, Day-18 GST filing)
    citedFigures → 7 chips (USD + INR cross-conversion, breach values)
```

The `AskMode` component renders the answer card with sample question chips
("What's our 30-day cash runway?", "Who's the largest overdue customer?",
etc.). Single question → single grounded answer. Not a chat.

---

## 3. AgentArtifact · human-readable provenance

Click any agent's "view artifact" badge — you get the **output**, not Python:

| Agent | Artifact |
|-------|----------|
| Collection | Editable email template (friendly/firm tone, merge fields) |
| Subscription | Renewal calendar with cancel-now / keep cards |
| Tax | Pre-filled return preview with line items + state-law citation |
| Scenario | 3 ranked plan cards (success %, buffer gain, rationale) |
| Treasury | Editable assumption knobs (floor, payroll date, recovery %) |

Every artifact has:
- **Inline customization input** ("soften tone for enterprise customers")
- **"Show technical detail" disclosure** (collapsed by default) — reveals
  the underlying Python skill for engineers/judges who ask

```
User types in Collection's customization input:
  "Soften the tone for enterprise customers above $25k ARR"
  └─ POST /api/agents/customize  { agent: "collection", instruction: "..." }
       └─ Supabase: UPDATE agent_customizations SET active=false WHERE agent='collection'
                    INSERT new row { agent, instruction, active=true }
       └─ Falls back to in-process memo store if migration not run yet
  Toast: "collection agent customized"

Next orchestrator run:
  └─ runSkill(..., from: "collection")
       └─ getCustomization("collection")  ← reads latest active row
       └─ userPromptFor(skillKey, intent, from, customization)
            └─ injects USER CUSTOMIZATION block into the prompt
       └─ Codex regenerates the skill with the user's guidance
```

---

## 4. Skill Library · `/skills`

Every committed skill — every Codex Prime run, regardless of which agent
asked — appears here, grouped by agent, sorted by `created_at DESC`.

### Click a skill
Opens a modal with the full Python source. Keyboard-dismissible.

### Export Codebase
JSZip walks every row, writes one `.py` per skill version, plus a `README.md`
header. Real Python files in a real `.zip`.

### Versioning
Each successful run gets `v(n+1)`. Each commit message includes:
- the calling agent
- the user-facing reason
- the input hash
- the output summary

---

## 5. Policy Envelope · `/policy`

Five toggles + two number inputs, persisted to the `policies` Supabase table
on change. The orchestrator reads the latest row at the start of every run's
"Policy Envelope" step.

This is the **trust boundary**. Change a value, run the orchestrator again,
and watch the auto-vs-queue mix shift live.

---

## 6. Architecture · `/architecture`

A static visual of the layered system: UI → Orchestrator → 5 Agents →
Codex Prime → 3-engine LLM cascade → Connector Registry. Useful for first-time
visitors and judges.

---

## 7. Multi-agent communication — how it actually works

Agents don't call each other directly. Every cross-agent action goes through
a single typed event bus:

- `src/lib/agents/event-bus.ts` — process-wide singleton, typed `subscribe()`
  and `emit()`, plus a `stream(runId)` async iterator the SSE handler uses.
- `src/lib/agents/types.ts` — discriminated `AgentEvent` union.

When Treasury detects a crunch, it emits:
```ts
bus.emit({
  kind: "agent.message",
  from: "treasury",
  to: "broadcast",
  subject: "ESCALATE: cash_crunch_detected",
  payload: { day, shortfall },
});
```

Other agents *don't* subscribe to this directly — the orchestrator owns the
routing and calls each agent with a `crisisMode` flag derived from the
treasury finding. This keeps the message flow auditable. The bus *also* feeds
the SSE stream to the browser, so the user literally watches the conversation.

---

## 8. Codex Prime — the shared coding agent

`src/lib/agents/specialist/codex-prime.ts` exposes one function:

```ts
runSkill({ runId, from, skillKey, intent, mode }): Promise<CodexResult>
```

It:
1. emits `codex.skill_request`
2. **reads the agent's active customization** via `getCustomization(from)`
3. picks an LLM engine via `selectProvider()` (Gemini → Groq → Codex cascade)
4. streams tokens; every token is `bus.emit({ kind: "codex.token", delta })`
5. on stream error before any tokens land, falls back to canonical template
6. commits source to `skills` (Supabase) with bumped version + duration
7. emits `codex.skill_committed` with engine label
   (`engine: gemini` or `gemini→template-fallback` or `engine: groq`)
8. returns `{ skill, code, outputSummary, durationMs, engine }`

This is why the Workshop pane animates live — it's the actual token stream
the LLM is producing, not playback.

---

## 9. Quickstart

```bash
# 1) install
npm install

# 2) plug in real LLM keys (one is enough; cascade picks the best)
echo 'GEMINI_API_KEY="..."' >> .env       # Google AI Studio key
echo 'GROQ_API_KEY="..."'   >> .env       # Groq key (fallback)
echo 'CODEX_API_KEY="sk-..."' >> .env     # OpenAI Codex (tertiary)

# 3) (optional) connect to real Plaid sandbox
echo 'PLAID_CLIENT_ID="..."' >> .env
echo 'PLAID_SECRET="..."'    >> .env

# 4) run
npm run dev          # http://localhost:8080

# 5) verify the health check
curl -s -H "Accept: application/json" http://localhost:8080/api/llm/health | jq

# 6) verify connector hydration
curl -s http://localhost:8080/api/connectors/list | jq '.connectors | length'
curl -s -X POST http://localhost:8080/api/connectors/sync \
     -H "Content-Type: application/json" -d '{}' | jq '.snapshot.totals'

# 7) verify Treasury projection
curl -s http://localhost:8080/api/treasury/projection | jq '.summary'

# 8) ask a CFO question
curl -s -X POST http://localhost:8080/api/ask \
     -H "Content-Type: application/json" \
     -d '{"question":"What is our biggest cash risk?"}' | jq

# 9) trigger a full orchestrator sweep
curl -s -X POST http://localhost:8080/api/agents/run \
     -H "Accept: text/event-stream" \
     -H "Content-Type: application/json" \
     -d '{"mode":"stream"}'
```

---

## 10. File map

```
src/
  lib/
    llm/                       # 3-engine cascade
      types.ts
      gemini.ts                # primary  (Gemini 2.5 Flash via Google AI Studio)
      groq.ts                  # fallback (llama-3.3-70b-versatile via Groq)
      codex.ts                 # tertiary (OpenAI, env-key gated)
      index.ts                 # selectProvider, healthAll, streamWithFallback

    connectors/                # 11 integrations
      types.ts                 # CanonicalSnapshot + USD/INR FX
      registry.ts              # syncAll, listConnectors, ensureSnapshot
      stripe.ts
      plaid.ts                 # real-sandbox path when PLAID_CLIENT_ID is set
      salesforce.ts
      quickbooks.ts            # + Tally + Zoho + Razorpay (Indian stack)
      saas-trackers.ts         # Gmail, Outlook, Slack, Teams

    agents/
      types.ts                 # AgentEvent discriminated union
      event-bus.ts             # process-wide pub/sub
      policy.ts                # Policy Envelope evaluator
      customizations.ts        # latest active per-agent instruction loader
      orchestrator.ts          # the LangGraph-style state machine
      specialist/
        codex-prime.ts         # shared coding agent (reads customizations)
        treasury.ts
        collection.ts
        subscription.ts
        tax.ts
        scenario.ts

    snapshot-adapter.server.ts # canonical → legacy agent shape
    skills-store.server.ts     # versioned commits (Supabase)
    supabase-admin.server.ts
    currency.ts                # USD + INR formatting (lakh / crore)
    services/csv-ingest.ts     # one-off CSV fallback (drawer only)

  routes/
    api/
      llm.health.ts            # GET  /api/llm/health
      connectors.list.ts       # GET  /api/connectors/list
      connectors.sync.ts       # POST /api/connectors/sync
      snapshot.ts              # GET  /api/snapshot
      treasury.projection.ts   # GET  /api/treasury/projection
      ask.ts                   # POST /api/ask
      agents.run.ts            # POST /api/agents/run (SSE)
      agents.customize.ts      # POST /api/agents/customize, GET ?agent=
      codex.stream.ts          # POST /api/codex/stream (SSE — workshop)
      csv.ingest.ts            # POST /api/csv/ingest (fallback)

  components/
    HealthBadge.tsx            # 3-engine status pill in TopNav
    ConnectionsPanel.tsx       # 11 connector tiles, auto-sync on mount
    TreasurySection.tsx        # caution banner + Run-all-agents CTA
    SolvencyChart.tsx          # Standby vs Autopilot, glide cursor
    AskMode.tsx                # grounded CFO Q&A panel
    AgentArtifact.tsx          # per-kind artifacts + customization input
    AgentConsole.tsx           # live transcript (registerStarter prop)
    LiveWorkshop.tsx           # token-stream Workshop variant
    Workshop.tsx               # single-skill Workshop variant
    CsvUpload.tsx              # one-off drawer (no longer primary)
    ApprovalQueue.tsx          # realtime approvals UI
    SkillLibrarySidebar.tsx

supabase/
  migrations/
    20260528065625_*.sql               # initial: skills, approvals, policies
    20260528120000_agent_customizations.sql  # new: per-agent customizations

USER_JOURNEY.md (this file)
titus_prime_product_narrative.md
```

---

## 11. What's still mocked

Three honesty notes for the code review:

1. **10 of 11 connectors return fixtures.** Plaid has a real sandbox path
   when `PLAID_CLIENT_ID`/`PLAID_SECRET` are set. The other 10 are deterministic
   adapters shaped exactly like real API responses — swap fixtures for real
   OAuth flows without touching the rest of the system.

2. **Python isn't actually executed.** Codex generates the Python and we
   trust it; we don't run it. Wiring E2B is the next P0 — the seam is
   `runSkill()` in `codex-prime.ts`.

3. **Skills aren't on a real on-disk `.git/` yet.** They're versioned rows
   in Supabase. `commitSkill()` is the seam where a `simple-git` filesystem
   implementation would slot in without changing any agent.

Everything else — the connectors, the canonical store, the bus, the policy,
the streaming, the engine cascade, the schema inference, the approval queue,
the export, the customization, the Ask Mode, the projection chart — is real.
