# Titus-Prime — User Journey & Execution Flow

This traces a complete end-to-end interaction: what the user does, how data moves
through the system, how the agents talk, and how the final output is produced.

## 0. Launch & health

- `npm run dev` boots the TanStack/Nitro server on port 8080 (8081 if taken).
- On boot, the LLM health check runs the three-engine cascade
  (Gemini → Groq → Codex) and logs an ASCII status block. `GET /api/llm/health`
  returns the same. With no keys, agents run in template mode; with a Gemini key,
  Codex Prime streams real LLM-authored Python.

## 1. Walking into the Boardroom (`/app`)

1. `ConnectionsPanel` mounts → auto-calls `POST /api/connectors/sync`.
2. The connector registry fans out across all 11 connectors in parallel, merges
   the results into one canonical snapshot, applies bounded "liveness" drift, and
   computes a diff vs. the previous snapshot.
3. A silent re-sync runs every 12s so the cockpit visibly moves on its own
   (balances settle, invoices age, the "picked up since last sync" strip refreshes).
4. The **Value Scoreboard** loads `GET /api/value/scoreboard` and renders the
   "Money Found" tally with an animated count-up.
5. The **Sentinel** feed loads `GET /api/value/anomalies` and lists what was
   caught without being asked.

## 2. Running a full sweep (the agentic core)

Trigger: "Run agents" in the Agent Console, or the Treasury "Run all agents" CTA.
`POST /api/agents/run` opens an SSE stream and calls `runOrchestrator`:

1. **Treasury Sentinel** runs first, projects 30-day cash, and (if a breach is
   found) broadcasts `ESCALATE: cash_crunch_detected` on the in-process event bus.
2. On crisis, the **Orchestrator** broadcasts "enter crisis mode." **Collection**,
   **Subscription Watchdog**, **Tax Compliance**, and **Scenario Modeler** react
   in parallel — real agent-to-agent message passing through the bus.
3. Each agent asks **Codex Prime** (`runSkill`) to write the Python skill it
   needs; tokens stream to the Workshop pane via `codex.token` events; the skill
   is committed to the library with a bumped version.
4. **Policy Envelope**: every proposed action is evaluated — inside the envelope →
   auto-executed; outside → inserted into the Supabase `approvals` queue.
5. **Value + Outcomes**: each action records a projected value event
   (`recordValueOnce`, de-duped by ref); `send_email` actions also record a
   pending outcome so the recovery-rate loop is grounded in real sends.
6. `run.completed` fires → the Boardroom refreshes the scoreboard, sentinel, and
   approval queue.

## 3. The Value Layer (what proves the agent was worth it)

- **Value Scoreboard** — `GET /api/value/scoreboard` → `{ totalUsd, realizedUsd,
projectedUsd, hoursSaved, byCategory, recentEvents }`. Realized-vs-projected
  bar, per-category cards, recent-events ticker.
- **Proven recovery rate** — `GET /api/value/outcomes`. Seeded with last month's
  history so it's never empty; `POST` resolves a pending outcome.
- **Sentinel** — `GET /api/value/anomalies`. Severity-ranked feed with a re-scan
  button and last-scan timestamp.
- **What-if** — `POST /api/value/whatif` with `{ hires, lostCustomer,
oneOffExpenseUsd, extraMrrUsd }` → re-projected 30-day runway + delta. Preset
  chips for one-click scenarios.

Storage is in-memory at process scope (`globalThis`) — works with zero DB setup
and survives hot reload.

## 4. Voice assistant (bottom-right widget)

A Wispr-Flow-style orb. Browser-native speech recognition →
`POST /api/voice/chat` (Gemini grounded in the live snapshot) → spoken reply via
gateway TTS, falling back to browser speech synthesis. Independent of the
text-based Ask Mode in the Boardroom.

## 5. Cloud + Email reality (honest states)

- `GET /api/cloud/aws` — real Cost Explorer data with creds, else "Simulated."
- `GET /api/cloud/gcp` — real service-account auth + billing-account listing;
  live cost only with a BigQuery export, else honest "Connected · no export."
- `POST /api/email/compose` — real RFC-822 message (Gmail-API-ready `raw`); real
  SMTP send with `GMAIL_USER` + `GMAIL_APP_PASSWORD`, else a true composed preview.

Optional env (server-side only, never `VITE_`): `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `GCP_SERVICE_ACCOUNT_JSON`, `GCP_BILLING_BQ_TABLE`,
`GMAIL_USER`, `GMAIL_APP_PASSWORD`. Engine selection: `PRIMARY_LLM=codex` promotes
Codex to primary the moment a `CODEX_API_KEY` is present — no code change.
