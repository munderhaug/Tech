# Architecture Decision Record — StageOps

ADR-style log of choices made while building. Newest first. Decisions locked in the
HANDOVER (PWA, React/TS, Supabase, PowerSync, server-side swappable AI) are treated as
given and not re-litigated here.

---

## ADR-007 — Open questions still pending for Martin

These are deliberately **not** hardcoded; the build flags them at the point of use.

1. **AI model host.** Extraction is behind a swappable `LlmProvider` (config: `VITE_LLM_PROVIDER`).
   Only a `mock` heuristic provider is wired this session — no live calls, no key. Decide
   cloud vs. self-hosted/EU OpenAI-compatible endpoint, then implement one provider class
   (see `src/services/extraction/index.ts` for the exact extension point).
2. **Soundcheck windows: per-artist or shared stage blocks?** Schema supports **both** —
   `schedule_block.artist_show_id` is nullable. Default usage is per-artist. Confirm the
   intended model before building richer schedule editing.
3. **Norway/EU working-time rest-period thresholds.** Placeholder constants live in
   `src/domain/crewCoverage.ts` (`DEFAULT_WORKING_TIME_RULES`: 6h-before-break, 11h-rest).
   These are **not** legally authoritative — confirm exact thresholds before relying on the
   crew warnings.

## ADR-006 — AI extraction behind a config-driven provider interface
**Decision:** `LlmProvider` interface + `MockLlmProvider`; provider chosen via
`VITE_LLM_PROVIDER` (default `mock`). **Why:** HANDOVER mandates a swappable provider and
flags the host as undecided. The mock does heuristic line parsing so the full pipeline
(paste → confidence-scored draft items → edit → match) is demoable with no key. AI output
is always a draft, never authoritative — the user edits/splits/deletes before saving.

## ADR-005 — Gap engine is pure, deterministic-first, human-confirmed
**Decision:** `src/domain/gapEngine.ts` matches model → category+qty deterministically.
A right-category/wrong-model match is reported as a **GAP needing confirmation**, never
silently MET. `buildGapResolution()` throws unless a resolution type **and** a non-empty
note are supplied, and records `resolved_by`/`resolved_at`. The DB mirrors this with
`gap_resolution.note NOT NULL CHECK (length(trim(note)) > 0)`. **Why:** "a gap can never be
silently cleared" is the product's core principle (PRD §4, AC §9.3).

## ADR-004 — All domain logic is pure and unit-tested, independent of persistence
**Decision:** Gap matching, resource/schedule conflict, power, comms, and crew analysis are
pure functions in `src/domain/` with Vitest coverage (`src/test/`). **Why:** these encode
the product's actual value and the acceptance criteria; keeping them free of React/Dexie
makes them testable and reusable when the backend changes.

## ADR-003 — DataStore interface; local Dexie store now, PowerSync later
**Decision:** UI/domain talk only to the `DataStore` interface (`src/data/store.ts`).
`LocalDataStore` (Dexie/IndexedDB) is the session implementation; a `PowerSyncDataStore`
will implement the same interface against local SQLite ↔ Supabase Postgres. **Why:** the
session backend is "scaffold, wire later" (no live Supabase/PowerSync). Dexie's
`useLiveQuery` gives reactive, offline-first reads that mimic PowerSync, so feature code is
written exactly as it will be against the real sync layer — only two lines in `main.tsx`
change when PowerSync lands. Offline-writable rows carry `client_uuid` for future sync
dedupe; chat messages carry a local `pending`→`sent` state to demonstrate send-on-reconnect.

## ADR-002 — Supabase migrations are the schema source of truth
**Decision:** `supabase/migrations/0001_init.sql` defines the full schema (enums, tables,
RLS stubs); `src/domain/types.ts` mirrors it; `supabase/seed.sql` mirrors the demo dataset.
**Why:** HANDOVER build order #1 — get the rider → line item → gap → resolution tables right
first; everything depends on them. The schema is kept clean enough that the v2 debrief
export "falls out for free" (no destructive resolution updates; resolutions are append-only
with who/when).

## ADR-001 — Stack scaffold
**Decision:** Vite + React + TypeScript, Tailwind + shadcn-style primitives (Radix),
react-router, `vite-plugin-pwa`. Dark-first mobile UI with a bottom nav (mobile) / sidebar
(desktop). **Why:** matches the locked stack; one responsive codebase; installable offline
PWA shell.
