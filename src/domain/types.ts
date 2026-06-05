// StageOps domain types — mirror of supabase/migrations schema.
// The TS app runs against these shapes via the DataStore interface (src/data/store.ts).
// Keep this file and the SQL migrations in lockstep.

// ---- Enums --------------------------------------------------------------

export const REQUIREMENT_CATEGORIES = [
  "SOUND_FOH",
  "SOUND_MON",
  "SOUND_INPUTS",
  "LIGHTING",
  "AV",
  "BACKLINE",
  "STAGING",
  "POWER",
  "CREW_CALL",
  "OTHER",
] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_STATUSES = ["MET", "GAP", "OVER_SPEC", "UNMATCHED"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const RESOLUTION_TYPES = [
  "SUBSTITUTED",
  "WONT_PROVIDE",
  "PENDING",
  "CROSS_RENTAL_ORDERED",
  "CLARIFICATION_NEEDED",
] as const;
export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

/** Resolution types that keep a gap visibly OPEN (amber) until moved to a closed state. */
export const OPEN_RESOLUTION_TYPES: ResolutionType[] = [
  "PENDING",
  "CROSS_RENTAL_ORDERED",
  "CLARIFICATION_NEEDED",
];

export const CREW_ROLES = [
  "TECH_PRODUCTION_MANAGER",
  "STAGE_MANAGER",
  "SOUND_ENGINEER",
  "MONITOR_ENGINEER",
  "AV_ENGINEER",
  "LIGHTING_ENGINEER",
  "CREW_CHIEF",
] as const;
export type CrewRole = (typeof CREW_ROLES)[number];

export const DEPARTMENTS = ["SOUND", "LIGHTS", "AV", "STAGE", "POWER", "GENERAL"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const CHAT_SCOPES = ["STAGE", "ARTIST", "DEPARTMENT", "ALL"] as const;
export type ChatScope = (typeof CHAT_SCOPES)[number];

export const WEATHER_STATUSES = ["GO", "HOLD", "STOP"] as const;
export type WeatherStatus = (typeof WEATHER_STATUSES)[number];

export const SCHEDULE_BLOCK_TYPES = [
  "LOAD_IN",
  "SOUNDCHECK",
  "LINECHECK",
  "SET",
  "CHANGEOVER",
  "CURFEW",
  "OTHER",
] as const;
export type ScheduleBlockType = (typeof SCHEDULE_BLOCK_TYPES)[number];

// ---- Entities -----------------------------------------------------------

export interface Festival {
  id: string;
  name: string;
  start_date: string; // ISO date
  end_date: string;
}

export interface Stage {
  id: string;
  festival_id: string;
  name: string;
  is_outdoor: boolean;
}

export interface ArtistShow {
  id: string;
  stage_id: string;
  festival_id: string;
  artist_name: string;
  date: string; // ISO date
  set_start: string | null; // ISO datetime
  set_end: string | null;
  changeover_after_min: number | null;
  advancing_tm_contact: string | null; // internal only, no artist access
  client_uuid: string;
  created_at: string;
  updated_at: string;
}

export type RiderFileType = "PDF" | "WORD" | "IMAGE" | "TEXT";

export interface RiderFile {
  id: string;
  artist_show_id: string;
  storage_path: string | null; // null when pasted text
  type: RiderFileType;
  raw_text: string | null; // extracted/pasted text used for extraction
  uploaded_by: string;
  uploaded_at: string;
  client_uuid: string;
}

/** Structured, parseable detail of a requirement (best-effort from extraction). */
export interface NormalizedSpec {
  qty?: number;
  make?: string;
  model?: string;
  spec?: string;
}

export interface RequirementItem {
  id: string;
  artist_show_id: string;
  rider_file_id: string | null;
  category: RequirementCategory;
  description: string; // raw text as parsed
  normalized: NormalizedSpec;
  confidence: number; // 0–1
  source_ref: string | null; // page/section of rider
  status: RequirementStatus;
  /** inventory_item the engine matched against, if any. */
  matched_inventory_id: string | null;
  created_by_ai: boolean;
  client_uuid: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  festival_id: string;
  stage_id: string | null; // null = shared / cross-rental pool
  category: RequirementCategory;
  make: string;
  model: string;
  qty: number;
  power_draw_w: number;
  spec: NormalizedSpec;
  client_uuid: string;
}

export interface Assignment {
  id: string;
  inventory_item_id: string;
  stage_id: string;
  artist_show_id: string | null;
  start_time: string; // ISO datetime
  end_time: string;
  client_uuid: string;
}

export interface GapResolution {
  id: string;
  requirement_item_id: string;
  resolution_type: ResolutionType;
  note: string; // NOT NULL + non-empty (enforced)
  resolved_by: string;
  resolved_at: string;
  client_uuid: string;
}

export interface RememberNote {
  id: string;
  artist_show_id: string;
  body: string;
  author: string;
  created_at: string;
  client_uuid: string;
}

export interface PostShowNote {
  id: string;
  artist_show_id: string;
  body: string;
  author: string;
  created_at: string;
  client_uuid: string;
}

export interface Attachment {
  id: string;
  artist_show_id: string;
  name: string;
  kind: string; // stage plot, scene file, timecode note, etc.
  storage_path: string | null;
  created_at: string;
  client_uuid: string;
}

export interface CrewMember {
  id: string;
  festival_id: string;
  name: string;
  role: CrewRole;
  department: Department;
}

export interface BreakLogEntry {
  start: string;
  end: string;
}

export interface Shift {
  id: string;
  crew_member_id: string;
  stage_id: string;
  start_time: string;
  end_time: string;
  call_time: string;
  breaks: BreakLogEntry[];
  client_uuid: string;
}

export interface ChatChannel {
  id: string;
  festival_id: string;
  scope: ChatScope;
  ref_id: string | null; // stage_id / artist_show_id / department name; null for ALL
  name: string;
}

export type ChatDeliveryStatus = "pending" | "sent";

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  client_uuid: string; // dedupe on sync
  delivery: ChatDeliveryStatus; // local offline-queue state
}

export interface PowerDistro {
  id: string;
  stage_id: string;
  name: string;
  capacity_w: number;
}

export interface CommsChannel {
  id: string;
  festival_id: string;
  rf_channel: string;
  assigned_to: string; // crew/department label
  department: Department;
}

export interface WeatherStatusRow {
  id: string;
  stage_id: string;
  status: WeatherStatus;
  note: string;
  updated_by: string;
  updated_at: string;
}

export interface ScheduleBlock {
  id: string;
  stage_id: string;
  date: string;
  type: ScheduleBlockType;
  label: string;
  start_time: string;
  end_time: string;
  /** Soundcheck windows may be per-artist OR shared stage blocks — schema supports both. */
  artist_show_id: string | null;
  client_uuid: string;
}
