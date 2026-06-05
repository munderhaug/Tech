// Local offline database (IndexedDB via Dexie).
//
// This is the session's stand-in for PowerSync's local SQLite. The table set mirrors the
// Supabase schema (supabase/migrations). When PowerSync is wired later, a PowerSyncDataStore
// implements the same DataStore interface and this file is swapped out — feature/domain code
// is unaffected because it only ever talks to the interface.

import Dexie, { type Table } from "dexie";
import type {
  ArtistShow,
  Assignment,
  Attachment,
  ChatChannel,
  ChatMessage,
  CommsChannel,
  CrewMember,
  Festival,
  GapResolution,
  InventoryItem,
  PostShowNote,
  PowerDistro,
  RememberNote,
  RequirementItem,
  RiderFile,
  ScheduleBlock,
  Shift,
  Stage,
  WeatherStatusRow,
} from "@/domain/types";

export class StageOpsDB extends Dexie {
  festivals!: Table<Festival, string>;
  stages!: Table<Stage, string>;
  artistShows!: Table<ArtistShow, string>;
  riderFiles!: Table<RiderFile, string>;
  requirementItems!: Table<RequirementItem, string>;
  inventoryItems!: Table<InventoryItem, string>;
  assignments!: Table<Assignment, string>;
  gapResolutions!: Table<GapResolution, string>;
  rememberNotes!: Table<RememberNote, string>;
  postShowNotes!: Table<PostShowNote, string>;
  attachments!: Table<Attachment, string>;
  crewMembers!: Table<CrewMember, string>;
  shifts!: Table<Shift, string>;
  chatChannels!: Table<ChatChannel, string>;
  chatMessages!: Table<ChatMessage, string>;
  powerDistros!: Table<PowerDistro, string>;
  commsChannels!: Table<CommsChannel, string>;
  weatherStatuses!: Table<WeatherStatusRow, string>;
  scheduleBlocks!: Table<ScheduleBlock, string>;
  meta!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("stageops");
    this.version(1).stores({
      festivals: "id",
      stages: "id, festival_id",
      artistShows: "id, festival_id, stage_id, date",
      riderFiles: "id, artist_show_id",
      requirementItems: "id, artist_show_id, status, category",
      inventoryItems: "id, festival_id, stage_id, category",
      assignments: "id, inventory_item_id, stage_id, artist_show_id",
      gapResolutions: "id, requirement_item_id, resolved_at",
      rememberNotes: "id, artist_show_id",
      postShowNotes: "id, artist_show_id",
      attachments: "id, artist_show_id",
      crewMembers: "id, festival_id, department",
      shifts: "id, crew_member_id, stage_id",
      chatChannels: "id, festival_id, scope, ref_id",
      chatMessages: "id, channel_id, created_at, delivery",
      powerDistros: "id, stage_id",
      commsChannels: "id, festival_id",
      weatherStatuses: "id, stage_id",
      scheduleBlocks: "id, stage_id, date, artist_show_id",
      meta: "key",
    });
  }
}

export const db = new StageOpsDB();
