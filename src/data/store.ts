// DataStore — the single seam between the UI/domain and the persistence layer.
//
// Today this resolves to LocalDataStore (Dexie/IndexedDB). Later, a PowerSyncDataStore
// implements the SAME interface against local SQLite ↔ Supabase Postgres, and nothing in
// features/ or domain/ changes. All reads return promises and are designed to be called
// inside Dexie's useLiveQuery so the UI stays reactive and offline-first.

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

/** Minimal repository surface shared by every entity. */
export interface Repo<T> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  bulkPut(items: T[]): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface DataStore {
  festivals: Repo<Festival>;
  stages: Repo<Stage>;
  artistShows: Repo<ArtistShow>;
  riderFiles: Repo<RiderFile>;
  requirementItems: Repo<RequirementItem>;
  inventoryItems: Repo<InventoryItem>;
  assignments: Repo<Assignment>;
  gapResolutions: Repo<GapResolution>;
  rememberNotes: Repo<RememberNote>;
  postShowNotes: Repo<PostShowNote>;
  attachments: Repo<Attachment>;
  crewMembers: Repo<CrewMember>;
  shifts: Repo<Shift>;
  chatChannels: Repo<ChatChannel>;
  chatMessages: Repo<ChatMessage>;
  powerDistros: Repo<PowerDistro>;
  commsChannels: Repo<CommsChannel>;
  weatherStatuses: Repo<WeatherStatusRow>;
  scheduleBlocks: Repo<ScheduleBlock>;

  // ---- Scoped query helpers (kept narrow; add as features need them) ----
  stagesForFestival(festivalId: string): Promise<Stage[]>;
  showsForStage(stageId: string): Promise<ArtistShow[]>;
  showsForFestival(festivalId: string): Promise<ArtistShow[]>;
  requirementsForShow(showId: string): Promise<RequirementItem[]>;
  riderFilesForShow(showId: string): Promise<RiderFile[]>;
  inventoryForStage(stageId: string, festivalId: string): Promise<InventoryItem[]>;
  resolutionsForRequirement(requirementId: string): Promise<GapResolution[]>;
  latestResolution(requirementId: string): Promise<GapResolution | undefined>;
  messagesForChannel(channelId: string): Promise<ChatMessage[]>;
  rememberForShow(showId: string): Promise<RememberNote[]>;
}

let current: DataStore | null = null;

export function setDataStore(store: DataStore): void {
  current = store;
}

export function getStore(): DataStore {
  if (!current) {
    throw new Error("DataStore not initialised. Call setDataStore() at startup.");
  }
  return current;
}
