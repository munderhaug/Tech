# StageOps

Mobile-first, offline-first PWA for festival **house crews** to run the rider →
delivered-equipment accountability loop, plus schedule, inventory, crew, chat, power,
comms, and weather. House-crew only — no artist-facing surface.

> Specs: [`docs/PRD.md`](docs/PRD.md) and [`docs/HANDOVER.md`](docs/HANDOVER.md).
> Architectural choices and open questions: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## The spine

```
rider file → AI extraction → confidence-scored requirement items
→ matched against stage inventory → MET | GAP | OVER_SPEC | UNMATCHED
→ every GAP resolved by a human with a resolution type + a non-empty reason (who + when)
```

A gap can never be silently cleared — enforced in `src/domain/gapEngine.ts` and at the DB
level (`gap_resolution.note NOT NULL CHECK …`).

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173  — seeds a demo festival on first run
npm test         # Vitest: domain logic + a full seed→flags integration test
npm run build    # typecheck + production PWA build
```

The app boots with a rigged demo (Fjordfest 2026, 2 stages, 3 artists) that surfaces every
flag: a quantity-short gap, an over-spec, an unmatched item, a **resource conflict** (one
shared console double-booked), a **tight changeover**, a **power overdraw**, and a **comms
clash**. Data lives in your browser (IndexedDB) and works fully offline.

## What's wired this session vs. later

| Area | This session | Wire later |
|---|---|---|
| Data layer | Local IndexedDB (Dexie) behind a `DataStore` interface | `PowerSyncDataStore` (local SQLite ↔ Supabase Postgres) — swap two lines in `src/main.tsx` |
| Schema | `supabase/migrations/0001_init.sql` (source of truth) + `supabase/seed.sql` | Apply to a real Supabase project |
| AI extraction | `MockLlmProvider` (heuristic, no key) | Implement one `LlmProvider` and set `VITE_LLM_PROVIDER` (see `src/services/extraction/index.ts`) |
| Auth / roles | Modelled in app state (current user + role) | Supabase auth, RLS policies (stubbed in the migration) |

### Wiring the real backend (later)
1. Create a Supabase project; run `supabase/migrations/*` then `supabase/seed.sql`.
2. Stand up PowerSync against that Postgres; add a `PowerSyncDataStore implements DataStore`.
3. In `src/main.tsx`, replace `new LocalDataStore()` with the PowerSync store. Nothing in
   `src/features/**` or `src/domain/**` changes.
4. Choose an AI host, implement a provider, set `VITE_LLM_PROVIDER` + endpoint env vars.

## Project layout

```
docs/                 PRD, HANDOVER, DECISIONS
supabase/             migrations (schema of record) + seed.sql
src/
  domain/             types + pure logic: gapEngine, resourceConflict, scheduleConflict,
                      powerLoad, commsClash, crewCoverage
  data/               DataStore interface + Dexie local store + demo seed
  services/extraction/  swappable LlmProvider (+ mock)
  features/           dashboard, artists, gaps, inventory, schedule, crew, chat, power,
                      comms, weather, more
  components/ui/      shadcn-style primitives
  app/                router, layout, app context
  test/               Vitest suites (domain + integration)
```

## Status

v1 build covers all ten feature areas, with the rider→gap→resolution spine built deepest.
Peripheral boards (power, comms, weather) are MVP-functional. See `docs/DECISIONS.md` for
the open questions still pending a human decision.
