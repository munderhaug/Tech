# StageOps — Product Requirements Document (v1)

**Status:** Draft for build
**Audience:** Claude Code (implementing agent)
**Read `HANDOVER.md` first.**

---

## 1. Problem

Festival house crews coordinate dozens of artists across multiple stages from technical riders that arrive late, in inconsistent formats, and are never fully deliverable. Today this lives in PDFs, spreadsheets, group chats, and people's heads. Mismatches between what an artist asked for and what the venue actually provides go undocumented until they become a problem at soundcheck — or a dispute afterward.

## 2. Goal

A single source of truth, per stage / per day / per artist, where rider requirements are extracted, matched against delivered equipment, and every gap is surfaced and resolved by a human with a documented reason. Mobile-first, offline-capable, house-crew only.

## 3. Users & roles

House crew only. Roles (used for permissions and filtered views):

- **Tech Production Manager** — full access across all stages.
- **Stage Manager** — full access to their stage(s).
- **Sound Engineer / Monitor Engineer** — sound line items, patch, their stage.
- **AV Engineer** — AV/video line items.
- **Lighting Engineer (LD)** — lighting line items, power.
- **Crew Chief** — crew & time, schedule.

All roles can read everything on their assigned stage(s); write scope is role-filtered for line items but everyone can post chat and read gaps. Keep the permission model simple in v1: assignment is by stage; department roles get write priority on their department's line items but any house user can resolve a gap (the resolution records *who*).

No external/guest/artist accounts.

## 4. Core concept — the accountability loop

```
Rider (file) 
  → AI extraction → Requirement line items (confidence-scored, categorized)
  → matched against Inventory/Patch (what's delivered on this stage)
  → each item resolves to: MET | GAP | OVER_SPEC
  → GAP must be resolved by a human: pick resolution type + write a reason note
  → living Gap Report per artist
```

A gap can never be silently cleared. Clearing requires a resolution type and a non-empty note.

---

## 5. Functional requirements

### 5.1 Rider Intake & AI Extraction

- Upload a rider: PDF, Word, image/scan, or pasted text/email.
- Pipeline (server-side): file → text (OCR for scanned/image) → LLM with structured JSON-schema output → categorized, confidence-scored line items.
- **Model provider must be swappable** via config (`LLM_PROVIDER`) — cloud API or self-hosted OpenAI-compatible endpoint. Do not hardcode.
- Each extracted **line item** has:
  - `category`: SOUND_FOH | SOUND_MON | SOUND_INPUTS | LIGHTING | AV | BACKLINE | STAGING | POWER | CREW_CALL | OTHER
  - `description` (raw text as parsed)
  - `normalized` (structured: qty, make, model, spec where parseable)
  - `confidence` (0–1) — surfaced in UI; low-confidence items flagged for human verification before matching.
  - `source_ref` (page/section of rider for traceability)
- User can edit, split, merge, delete, or manually add line items. AI output is a draft, never authoritative.

### 5.2 Gap Engine (priority feature)

- Each requirement line item is matched against the stage's inventory/patch.
- Status per item:
  - **MET** — equivalent or better delivered.
  - **GAP** — missing, substituted-downgrade, or quantity short.
  - **OVER_SPEC** — providing more than requested (informational).
- Matching: deterministic rules first (model match, category + qty), AI-assisted equivalence suggestion second (e.g. "SD10 covers this input count"). AI *suggests*, human *confirms*.
- **Gap resolution** (mandatory to clear): `resolution_type` ∈
  - `SUBSTITUTED` (note what + why it's acceptable)
  - `WONT_PROVIDE` (note: artist notified/accepted?)
  - `PENDING` (note: what we're waiting on, ETA)
  - `CROSS_RENTAL_ORDERED` (note: vendor, ETA)
  - `CLARIFICATION_NEEDED` (note: question for artist TM — internal tracking only, not sent to artist)
  - plus free-text `note` (required, non-empty) and auto-captured `resolved_by`, `resolved_at`.
- A gap in `PENDING` / `CLARIFICATION_NEEDED` / `CROSS_RENTAL_ORDERED` stays visibly open (amber) until moved to a closed state.
- **Gap Report**: per-artist rollup of all items by status. This is the prep checklist and the coverage record. (Per-festival export is v2 — but model the data so it's trivially aggregatable.)

### 5.3 Inventory & Patch

- House inventory per stage (and shared/cross-rental pool).
- Patch sheet / input list per artist per stage.
- **Resource-conflict detection**: when the same physical resource (e.g. a specific console) is assigned to two stages with overlapping time windows, flag it automatically. This is a top source of real-world failure — make the conflict loud.

### 5.4 Stage Schedule / Day Sheet

- Timeline per stage per day: load-in, soundcheck/linecheck windows, set times, changeover windows, curfew.
- **Changeover window length must be explicit and visible** — show how tight each flip is; flag impossible/overlapping changeovers.
- Drag to adjust; conflicts highlight.
- (Confirm with human: are soundcheck windows per-artist or shared stage blocks? — see HANDOVER open questions.)

### 5.5 Artist Page (per artist, per show)

A dedicated space holding everything for one act:

- Rider file(s) + parsed requirements + current gap status summary.
- **"Things to remember"** free-form notes — the tribal knowledge (e.g. "runs own playback off USB-C, bring adapter"; "deal with stage manager, not the TM, before doors").
- Patch sheet / input list / stage plot / monitor mixes.
- Set time, changeover notes, advancing-TM contact (stored internally; no artist access).
- File attachments (stage plots, scene files, timecode notes).
- Post-show notes (carry-forward field for next year — feeds the v2 debrief).

### 5.6 Crew & Time Management

- Roster per stage and department; shift assignments; call times.
- Break / rest-period tracking — must support EU/Norway working-time rules. **Confirm exact thresholds with the human before hardcoding.** Flag coverage gaps.

### 5.7 Internal Chat

- House-crew only.
- Threaded by **stage** and by **artist** (a message about Stage 2's 14:00 changeover lives on that artist's thread).
- Department channels (sound / lights / AV / stage) + one all-house channel for site-wide calls (weather hold, power issue).
- Must work offline: queue messages, send on reconnect (same sync discipline as data).

### 5.8 Power / Load Calculator

- Per stage: sum equipment draw against available distro capacity.
- Flag overdraw before it trips a breaker mid-set.

### 5.9 Walkie / Comms Channel Map

- Assign RF/walkie channels per crew/department; detect and flag clashes.

### 5.10 Weather / Contingency Board

- Shared hold / stop / go status for outdoor stages, visible to everyone instantly. Treat as high-priority realtime state.

---

## 6. Non-functional requirements

- **Mobile-first responsive** PWA; installable; full-screen.
- **Offline-first**: full read + write offline; background sync on reconnect; conflict resolution handled by the sync layer (PowerSync). Test the "two editors, flaky connection, same gap" case explicitly.
- **Realtime** where it matters: chat, weather board, gap status, schedule changes.
- **Auth**: house crew only; stage-scoped assignment; role-based write scope.
- **Data sovereignty**: AI provider swappable; prefer EU/self-hosted option (human decision pending). No artist PII beyond internal TM contact.
- **Performance**: usable on a mid-range phone over poor connectivity.

## 7. Tech stack (locked — see HANDOVER)

- React + TypeScript, Tailwind, shadcn/ui — PWA.
- Supabase (Postgres, auth, realtime, storage).
- PowerSync for offline-first Postgres sync.
- Server-side AI extraction behind a swappable provider interface.

## 8. Suggested data model (starting point — refine in migrations)

```
festival (id, name, start_date, end_date)
stage (id, festival_id, name)
artist_show (id, stage_id, festival_id, artist_name, date, set_start, set_end,
             changeover_after_min, advancing_tm_contact)
rider_file (id, artist_show_id, storage_path, type, uploaded_by, uploaded_at)
requirement_item (id, artist_show_id, category, description, normalized_json,
                  confidence, source_ref, status[MET|GAP|OVER_SPEC|UNMATCHED],
                  created_by_ai bool)
inventory_item (id, festival_id, stage_id NULL=shared pool, make, model, qty,
                power_draw_w, spec_json)
assignment (id, inventory_item_id, stage_id, artist_show_id, start_time, end_time)
              -- used for resource-conflict detection
gap_resolution (id, requirement_item_id, resolution_type, note NOT NULL,
                resolved_by, resolved_at)
remember_note (id, artist_show_id, body, author, created_at)
crew_member (id, festival_id, name, role, department)
shift (id, crew_member_id, stage_id, start_time, end_time, call_time, break_log_json)
chat_channel (id, festival_id, scope[STAGE|ARTIST|DEPARTMENT|ALL], ref_id)
chat_message (id, channel_id, author_id, body, created_at, client_uuid /*dedupe on sync*/)
power_distro (id, stage_id, capacity_w)
comms_channel (id, festival_id, rf_channel, assigned_to)
weather_status (id, stage_id, status[GO|HOLD|STOP], note, updated_by, updated_at)
```

Note `client_uuid` on offline-writable rows for sync dedupe/idempotency.

## 9. Acceptance criteria (v1 done when)

1. A rider PDF can be uploaded and produces confidence-scored, categorized, editable line items.
2. Every line item shows MET / GAP / OVER_SPEC against stage inventory.
3. A GAP cannot be closed without a resolution type **and** a non-empty note; resolution records who and when.
4. Assigning the same inventory item to two overlapping shows raises a visible conflict.
5. The stage day sheet shows set times and explicit changeover windows, flagging impossible flips.
6. Each artist has a page with rider, gaps, "things to remember," patch, files, set time, post-show notes.
7. Crew shifts with call times and break tracking exist; coverage gaps flag.
8. Chat works threaded by stage/artist/department, including offline send-on-reconnect.
9. Power calc flags overdraw; comms map flags channel clashes; weather board shows shared live status.
10. The entire app works offline (read + write) and syncs cleanly on reconnect, including the two-editors-same-gap conflict case.

## 10. Out of scope (v1)

- Photo verification of delivered gear.
- End-of-festival debrief export UI (data must remain aggregatable for v2).
- Any artist/guest-facing surface.
