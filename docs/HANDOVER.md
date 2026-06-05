# StageOps — Handover to Claude Code

> Read this first, then `docs/PRD.md`. This file gives you context and the decisions already made so you don't re-litigate them. The PRD is the spec.

## What we're building

A **mobile-first** festival stage-production management tool for the **house crew** — technical production manager, sound/AV/lighting engineers, stage managers. **Not** for visiting artists or their touring techs. No external/guest login in v1.

The spine of the product is one accountability loop:

```
rider requirement → matched against delivered equipment → gap detected → human resolves gap with a reason
```

Everything else (schedule, crew, chat, artist pages) hangs off that spine. If you find yourself building something that doesn't serve that loop, stop and flag it.

## Who uses it

Internal house crew only, across roles: tech prod manager, sound engineer, monitor engineer, AV engineer, lighting engineer (LD), stage manager, crew chief. Multiple stages, multiple days, many artists per stage per day. A festival week can mean 30+ riders landing in a few days.

## Non-negotiable product principles

1. **Gaps are normal, not failures.** Not everything in a rider gets delivered. The tool's job is to surface every mismatch and force a human to resolve it with a documented reason — never to hide or auto-accept it.
2. **Mobile-first, desktop-capable.** Primary use is on a phone or tablet backstage. Desktop is the control-room/FOH view. Same codebase, responsive.
3. **Offline-first.** Backstage Wi-Fi is unreliable. The app must work fully offline (read + write) and sync when connectivity returns. This is a hard requirement, not a nice-to-have. Two engineers editing the same gap on a flaky connection is the real-world scenario you must handle.
4. **House crew only.** No artist-facing surface in v1. Don't build guest auth, artist portals, or rider-submission flows.

## Decisions already locked (do not re-open without asking)

| Decision | Choice | Why |
|---|---|---|
| App type | Installable **PWA** | Mixed devices (personal iPhones/Android, prod iPad, FOH laptop); no app-store cycle for mid-festival fixes; native offline via service workers |
| Frontend | **React + TypeScript**, Tailwind, shadcn/ui (or Radix) | One responsive codebase, mobile-first |
| Backend / DB | **Postgres** (via Supabase: Postgres + auth + realtime + storage) | Relational domain fits riders → line items → gaps → resolutions; resource-conflict queries need SQL |
| Offline sync | **PowerSync** on top of Postgres (local SQLite ↔ Postgres) | Handles offline writes + conflict resolution; don't roll your own |
| Realtime (chat, live updates) | Supabase Realtime, with offline queue using same sync discipline | |
| AI rider extraction | **Server-side**, not on device | Heavy; needs a real model; keep swappable. Pipeline: PDF/image → OCR (for scanned) → LLM structured output (JSON schema / function calling) → confidence-scored line items |

### Open question for the human (Martin) before AI work starts
The AI extraction model host is **not yet decided**. Martin has a strong data-sovereignty preference (self-hosted / EU-jurisdiction models). Build the extraction layer behind an interface so the model provider is swappable (cloud API vs. self-hosted OpenAI-compatible endpoint). Do **not** hardcode a single provider. Default to a config-driven `LLM_PROVIDER` abstraction.

## v1 scope (build these)

- Rider Intake & AI Extraction (confidence-scored line items)
- **Gap Engine** (the heart — requirement → match → gap → resolved-with-reason)
- Inventory & Patch + automatic resource-conflict flagging (same gear, two stages, overlapping time)
- Stage Schedule / Day Sheet (load-in, soundcheck windows, set times, changeover windows, curfew)
- Artist Page (rider + parsed reqs + gap status, "things to remember" notes, patch/input list, set time, file attachments, post-show notes)
- Crew & Time Management (roster, shifts, call times, breaks/rest-period tracking)
- Internal Chat (threaded by stage and by artist + department channels + all-house channel)
- Power/load calculator (sum draw per stage vs. distro, flag overdraw)
- Walkie/comms channel map (RF channel assignment, avoid clashes)
- Weather/contingency board (shared hold/stop status for outdoor stages)

## Explicitly OUT of v1 (do not build)

- **Photo verification** of delivered gear — cut entirely.
- **End-of-festival debrief export** — cut from v1. NOTE: the gap engine already captures the underlying data, so this is a cheap v2 export. Keep the data model clean enough that this falls out for free later. Don't build the export UI now.
- Any artist/guest-facing features.

## Suggested build order

1. **Data model + Supabase schema** (the rider → line item → gap → resolution tables are the foundation — get these right first; everything depends on them).
2. **Offline sync wiring** (PowerSync) — prove a write made offline syncs and conflicts resolve. Do this early; retrofitting offline is painful.
3. **Auth + roles** (house crew only).
4. **Artist Page + Inventory** (CRUD, the containers).
5. **Rider intake → AI extraction → line items** (behind the swappable LLM interface).
6. **Gap Engine** (matching + resolution flow with mandatory reason).
7. **Stage Schedule / Day Sheet** + resource-conflict detection.
8. **Crew & Time**, **Chat**, **Power calc**, **Comms map**, **Weather board**.

## What to produce as you go

- Keep a running `docs/DECISIONS.md` (ADR-style) for any architectural choice you make.
- Migrations checked in; schema is the source of truth.
- Seed data: a sample festival (2 stages, 1 day, 3 artists, sample riders) so the app is demoable without manual setup.

## Things to ask the human about before assuming

- AI model provider/host (see open question above).
- Whether soundcheck/linecheck windows are per-artist or shared stage blocks (affects schedule model).
- Norway/EU working-time rest-period rules — confirm the exact thresholds to enforce in the crew module rather than guessing.
