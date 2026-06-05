// Demo seed — loaded into the local DB on first run so StageOps is demoable with zero setup.
//
// The scenario is deliberately rigged to exercise every flag in the product:
//   • a quantity-short GAP and an UNMATCHED requirement
//   • an OVER_SPEC item
//   • a RESOURCE CONFLICT (one shared console double-booked across overlapping shows)
//   • a TIGHT/IMPOSSIBLE CHANGEOVER on the main stage
//   • a POWER OVERDRAW on the main stage
//
// Mirrored by supabase/seed.sql for the eventual Postgres backend.

import { db } from "./local/db";
import { matchRequirement } from "@/domain/gapEngine";
import type {
  ArtistShow,
  ChatChannel,
  CommsChannel,
  CrewMember,
  Festival,
  InventoryItem,
  PowerDistro,
  RequirementItem,
  RiderFile,
  ScheduleBlock,
  Shift,
  Stage,
  WeatherStatusRow,
} from "@/domain/types";

const FESTIVAL_ID = "fest-fjordfest-2026";
const MAIN = "stage-main";
const TENT = "stage-tent";
const DAY = "2026-06-20";
const USER = "Seed Crew";

const iso = (time: string) => `${DAY}T${time}:00+02:00`;
const nowIso = () => new Date().toISOString();
const uuid = () => globalThis.crypto.randomUUID();

const festival: Festival = {
  id: FESTIVAL_ID,
  name: "Fjordfest 2026",
  start_date: "2026-06-19",
  end_date: "2026-06-21",
};

const stages: Stage[] = [
  { id: MAIN, festival_id: FESTIVAL_ID, name: "Main Stage", is_outdoor: true },
  { id: TENT, festival_id: FESTIVAL_ID, name: "Club Tent", is_outdoor: false },
];

// ---- Shows. Main stage has a deliberately impossible changeover. ----
const AURORA = "show-aurora";
const GLACIER = "show-glacier";
const MIDNIGHT = "show-midnight";

const shows: ArtistShow[] = [
  {
    id: AURORA,
    stage_id: MAIN,
    festival_id: FESTIVAL_ID,
    artist_name: "Aurora Sound",
    date: DAY,
    set_start: iso("20:00"),
    set_end: iso("21:00"),
    changeover_after_min: 45, // needs 45 min, only gets 20 → flagged
    advancing_tm_contact: "tm@aurorasound.example (internal only)",
    client_uuid: uuid(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: GLACIER,
    stage_id: MAIN,
    festival_id: FESTIVAL_ID,
    artist_name: "Glacier Drop",
    date: DAY,
    set_start: iso("21:20"),
    set_end: iso("22:30"),
    changeover_after_min: 30,
    advancing_tm_contact: null,
    client_uuid: uuid(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: MIDNIGHT,
    stage_id: TENT,
    festival_id: FESTIVAL_ID,
    artist_name: "Midnight Sun",
    date: DAY,
    set_start: iso("20:30"), // overlaps Aurora's set → shared console conflict
    set_end: iso("21:30"),
    changeover_after_min: 30,
    advancing_tm_contact: null,
    client_uuid: uuid(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

// ---- Inventory. SD12 lives in the shared pool (stage_id null). ----
const INV_SD12 = "inv-sd12";
const INV_K2 = "inv-k2";
const INV_SM58 = "inv-sm58";
const INV_WEDGE = "inv-wedge";
const INV_MEGAPOINTE = "inv-megapointe";

const inventory: InventoryItem[] = [
  {
    id: INV_SD12,
    festival_id: FESTIVAL_ID,
    stage_id: null, // shared / cross-rental pool
    category: "SOUND_FOH",
    make: "DiGiCo",
    model: "SD12",
    qty: 1,
    power_draw_w: 250,
    spec: { model: "SD12" },
    client_uuid: uuid(),
  },
  {
    id: INV_K2,
    festival_id: FESTIVAL_ID,
    stage_id: MAIN,
    category: "SOUND_FOH",
    make: "L-Acoustics",
    model: "K2",
    qty: 16, // rider asks 12 → OVER_SPEC
    power_draw_w: 1000,
    spec: { model: "K2" },
    client_uuid: uuid(),
  },
  {
    id: INV_SM58,
    festival_id: FESTIVAL_ID,
    stage_id: MAIN,
    category: "SOUND_INPUTS",
    make: "Shure",
    model: "SM58",
    qty: 8, // rider asks 12 → GAP (quantity short)
    power_draw_w: 0,
    spec: { model: "SM58" },
    client_uuid: uuid(),
  },
  {
    id: INV_WEDGE,
    festival_id: FESTIVAL_ID,
    stage_id: MAIN,
    category: "SOUND_MON",
    make: "d&b",
    model: "M4",
    qty: 8,
    power_draw_w: 400,
    spec: { model: "M4" },
    client_uuid: uuid(),
  },
  {
    id: INV_MEGAPOINTE,
    festival_id: FESTIVAL_ID,
    stage_id: MAIN,
    category: "LIGHTING",
    make: "Robe",
    model: "MegaPointe",
    qty: 16,
    power_draw_w: 670,
    spec: { model: "MegaPointe" },
    client_uuid: uuid(),
  },
];

// ---- Aurora's rider: raw text (for the intake demo) + extracted requirements. ----
const auroraRiderText = `AURORA SOUND — TECHNICAL RIDER (Fjordfest)
FOH
- 1x DiGiCo SD12 at front of house
- 12x L-Acoustics K2 main hangs
INPUTS
- 12x Shure SM58 vocal mics
- 4x DI boxes for keys/tracks
MONITORS
- 6x d&b M4 wedges
LIGHTING
- 8x moving head wash fixtures
BACKLINE
- 1x Yamaha grand piano (acoustic)`;

const auroraRiderFile: RiderFile = {
  id: "rider-aurora",
  artist_show_id: AURORA,
  storage_path: null,
  type: "TEXT",
  raw_text: auroraRiderText,
  uploaded_by: USER,
  uploaded_at: nowIso(),
  client_uuid: uuid(),
};

// Pre-extracted requirement drafts for Aurora (so the Gap Report is populated on first run).
const auroraReqSpecs: Array<Omit<RequirementItem,
  "id" | "status" | "matched_inventory_id" | "client_uuid" | "created_at" | "updated_at" |
  "artist_show_id" | "rider_file_id"> & { id: string }> = [
  {
    id: "req-a-sd12",
    category: "SOUND_FOH",
    description: "1x DiGiCo SD12 at front of house",
    normalized: { qty: 1, make: "DiGiCo", model: "SD12" },
    confidence: 0.93,
    source_ref: "FOH / line 3",
    created_by_ai: true,
  },
  {
    id: "req-a-k2",
    category: "SOUND_FOH",
    description: "12x L-Acoustics K2 main hangs",
    normalized: { qty: 12, make: "L-Acoustics", model: "K2" },
    confidence: 0.9,
    source_ref: "FOH / line 4",
    created_by_ai: true,
  },
  {
    id: "req-a-sm58",
    category: "SOUND_INPUTS",
    description: "12x Shure SM58 vocal mics",
    normalized: { qty: 12, make: "Shure", model: "SM58" },
    confidence: 0.88,
    source_ref: "INPUTS / line 6",
    created_by_ai: true,
  },
  {
    id: "req-a-di",
    category: "SOUND_INPUTS",
    description: "4x DI boxes for keys/tracks",
    normalized: { qty: 4 },
    confidence: 0.55, // low confidence → flagged for verification
    source_ref: "INPUTS / line 7",
    created_by_ai: true,
  },
  {
    id: "req-a-wedge",
    category: "SOUND_MON",
    description: "6x d&b M4 wedges",
    normalized: { qty: 6, make: "d&b", model: "M4" },
    confidence: 0.89,
    source_ref: "MONITORS / line 9",
    created_by_ai: true,
  },
  {
    id: "req-a-light",
    category: "LIGHTING",
    description: "8x moving head wash fixtures",
    normalized: { qty: 8 },
    confidence: 0.7,
    source_ref: "LIGHTING / line 11",
    created_by_ai: true,
  },
  {
    id: "req-a-piano",
    category: "BACKLINE",
    description: "1x Yamaha grand piano (acoustic)",
    normalized: { qty: 1, make: "Yamaha" },
    confidence: 0.6,
    source_ref: "BACKLINE / line 13",
    created_by_ai: true,
  },
];

const crew: CrewMember[] = [
  { id: "crew-tpm", festival_id: FESTIVAL_ID, name: "Ingrid Holm", role: "TECH_PRODUCTION_MANAGER", department: "GENERAL" },
  { id: "crew-foh", festival_id: FESTIVAL_ID, name: "Lars Vik", role: "SOUND_ENGINEER", department: "SOUND" },
  { id: "crew-mon", festival_id: FESTIVAL_ID, name: "Mette Dahl", role: "MONITOR_ENGINEER", department: "SOUND" },
  { id: "crew-ld", festival_id: FESTIVAL_ID, name: "Jonas Berg", role: "LIGHTING_ENGINEER", department: "LIGHTS" },
  { id: "crew-sm", festival_id: FESTIVAL_ID, name: "Sofie Aas", role: "STAGE_MANAGER", department: "STAGE" },
];

const shifts: Shift[] = [
  {
    id: "shift-foh", crew_member_id: "crew-foh", stage_id: MAIN,
    call_time: iso("14:00"), start_time: iso("14:00"), end_time: iso("23:30"),
    breaks: [], client_uuid: uuid(), // 9.5h, no break → NO_BREAK warning
  },
  {
    id: "shift-sm", crew_member_id: "crew-sm", stage_id: MAIN,
    call_time: iso("13:00"), start_time: iso("13:00"), end_time: iso("19:00"),
    breaks: [{ start: iso("16:00"), end: iso("16:30") }], client_uuid: uuid(),
  },
];

const distros: PowerDistro[] = [
  // Main-stage draw (K2 16×1000 + wedges 8×400 + MegaPointe 16×670 = 29,920W) exceeds this.
  { id: "distro-main", stage_id: MAIN, name: "Main Stage Distro A", capacity_w: 24000 },
  { id: "distro-tent", stage_id: TENT, name: "Tent Distro", capacity_w: 16000 },
];

const comms: CommsChannel[] = [
  { id: "comms-1", festival_id: FESTIVAL_ID, rf_channel: "CH1", assigned_to: "Stage Managers", department: "STAGE" },
  { id: "comms-2", festival_id: FESTIVAL_ID, rf_channel: "CH2", assigned_to: "Sound", department: "SOUND" },
  // Clash: CH2 reused by Lights.
  { id: "comms-3", festival_id: FESTIVAL_ID, rf_channel: "CH2", assigned_to: "Lights", department: "LIGHTS" },
];

const weather: WeatherStatusRow[] = [
  { id: "weather-main", stage_id: MAIN, status: "GO", note: "Clear, light wind.", updated_by: USER, updated_at: nowIso() },
];

const channels: ChatChannel[] = [
  { id: "chan-all", festival_id: FESTIVAL_ID, scope: "ALL", ref_id: null, name: "All-House" },
  { id: "chan-main", festival_id: FESTIVAL_ID, scope: "STAGE", ref_id: MAIN, name: "Main Stage" },
  { id: "chan-tent", festival_id: FESTIVAL_ID, scope: "STAGE", ref_id: TENT, name: "Club Tent" },
  { id: "chan-sound", festival_id: FESTIVAL_ID, scope: "DEPARTMENT", ref_id: "SOUND", name: "Sound Dept" },
  { id: "chan-aurora", festival_id: FESTIVAL_ID, scope: "ARTIST", ref_id: AURORA, name: "Aurora Sound" },
];

const scheduleBlocks: ScheduleBlock[] = [
  { id: "sb-aurora-load", stage_id: MAIN, date: DAY, type: "LOAD_IN", label: "Aurora load-in", start_time: iso("14:00"), end_time: iso("16:00"), artist_show_id: AURORA, client_uuid: uuid() },
  { id: "sb-aurora-sc", stage_id: MAIN, date: DAY, type: "SOUNDCHECK", label: "Aurora soundcheck", start_time: iso("17:00"), end_time: iso("18:00"), artist_show_id: AURORA, client_uuid: uuid() },
  { id: "sb-aurora-set", stage_id: MAIN, date: DAY, type: "SET", label: "Aurora Sound", start_time: iso("20:00"), end_time: iso("21:00"), artist_show_id: AURORA, client_uuid: uuid() },
  { id: "sb-glacier-set", stage_id: MAIN, date: DAY, type: "SET", label: "Glacier Drop", start_time: iso("21:20"), end_time: iso("22:30"), artist_show_id: GLACIER, client_uuid: uuid() },
  { id: "sb-curfew", stage_id: MAIN, date: DAY, type: "CURFEW", label: "Curfew", start_time: iso("23:00"), end_time: iso("23:00"), artist_show_id: null, client_uuid: uuid() },
];

// Two assignments of the SAME shared SD12 across overlapping windows → resource conflict.
const assignments = [
  {
    id: "asg-sd12-aurora", inventory_item_id: INV_SD12, stage_id: MAIN, artist_show_id: AURORA,
    start_time: iso("19:00"), end_time: iso("21:15"), client_uuid: uuid(),
  },
  {
    id: "asg-sd12-midnight", inventory_item_id: INV_SD12, stage_id: TENT, artist_show_id: MIDNIGHT,
    start_time: iso("20:00"), end_time: iso("21:45"), client_uuid: uuid(),
  },
];

const rememberNotes = [
  {
    id: "rem-aurora-1", artist_show_id: AURORA,
    body: "Aurora runs own playback off USB-C — bring a USB-C → 3.5mm + USB-C → XLR adapter to FOH.",
    author: "Lars Vik", created_at: nowIso(), client_uuid: uuid(),
  },
  {
    id: "rem-aurora-2", artist_show_id: AURORA,
    body: "Deal with their stage manager (not the TM) before doors. TM is unreachable during the set.",
    author: "Sofie Aas", created_at: nowIso(), client_uuid: uuid(),
  },
];

/** Idempotent: only seeds when the festival is absent. */
export async function seedIfEmpty(): Promise<void> {
  const existing = await db.festivals.get(FESTIVAL_ID);
  if (existing) return;

  // Run the gap engine against Aurora's inventory so seeded statuses match live behaviour.
  const auroraInventory = inventory.filter(
    (i) => i.stage_id === MAIN || i.stage_id === null,
  );
  const requirements: RequirementItem[] = auroraReqSpecs.map((spec) => {
    const base: RequirementItem = {
      ...spec,
      artist_show_id: AURORA,
      rider_file_id: auroraRiderFile.id,
      status: "UNMATCHED",
      matched_inventory_id: null,
      client_uuid: uuid(),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const match = matchRequirement(base, auroraInventory);
    return { ...base, status: match.status, matched_inventory_id: match.matchedInventoryId };
  });

  await db.transaction("rw", db.tables, async () => {
    await db.festivals.put(festival);
    await db.stages.bulkPut(stages);
    await db.artistShows.bulkPut(shows);
    await db.riderFiles.put(auroraRiderFile);
    await db.requirementItems.bulkPut(requirements);
    await db.inventoryItems.bulkPut(inventory);
    await db.assignments.bulkPut(assignments);
    await db.crewMembers.bulkPut(crew);
    await db.shifts.bulkPut(shifts);
    await db.powerDistros.bulkPut(distros);
    await db.commsChannels.bulkPut(comms);
    await db.weatherStatuses.bulkPut(weather);
    await db.chatChannels.bulkPut(channels);
    await db.scheduleBlocks.bulkPut(scheduleBlocks);
    await db.rememberNotes.bulkPut(rememberNotes);
    await db.meta.put({ key: "seeded_at", value: nowIso() });
  });
}

export const SEED_IDS = { FESTIVAL_ID, MAIN, TENT, AURORA, GLACIER, MIDNIGHT };
