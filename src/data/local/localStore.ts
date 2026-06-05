// LocalDataStore — Dexie-backed implementation of DataStore.
// Queries read Dexie tables directly so Dexie's observability tracks them; when these
// methods are invoked inside useLiveQuery, the UI re-renders on any write. This is what
// gives us reactive, offline-first behaviour without a server this session.

import type { Table } from "dexie";
import { db } from "./db";
import type { DataStore, Repo } from "../store";
import type {
  ArtistShow,
  GapResolution,
  InventoryItem,
  RequirementItem,
} from "@/domain/types";

function repo<T>(table: Table<T, string>): Repo<T> {
  return {
    all: () => table.toArray(),
    get: (id) => table.get(id),
    put: async (item) => {
      await table.put(item);
    },
    bulkPut: async (items) => {
      await table.bulkPut(items);
    },
    remove: async (id) => {
      await table.delete(id);
    },
  };
}

export class LocalDataStore implements DataStore {
  festivals = repo(db.festivals);
  stages = repo(db.stages);
  artistShows = repo(db.artistShows);
  riderFiles = repo(db.riderFiles);
  requirementItems = repo(db.requirementItems);
  inventoryItems = repo(db.inventoryItems);
  assignments = repo(db.assignments);
  gapResolutions = repo(db.gapResolutions);
  rememberNotes = repo(db.rememberNotes);
  postShowNotes = repo(db.postShowNotes);
  attachments = repo(db.attachments);
  crewMembers = repo(db.crewMembers);
  shifts = repo(db.shifts);
  chatChannels = repo(db.chatChannels);
  chatMessages = repo(db.chatMessages);
  powerDistros = repo(db.powerDistros);
  commsChannels = repo(db.commsChannels);
  weatherStatuses = repo(db.weatherStatuses);
  scheduleBlocks = repo(db.scheduleBlocks);

  stagesForFestival(festivalId: string) {
    return db.stages.where("festival_id").equals(festivalId).toArray();
  }

  showsForStage(stageId: string) {
    return db.artistShows.where("stage_id").equals(stageId).toArray();
  }

  showsForFestival(festivalId: string) {
    return db.artistShows.where("festival_id").equals(festivalId).toArray();
  }

  requirementsForShow(showId: string) {
    return db.requirementItems.where("artist_show_id").equals(showId).toArray();
  }

  riderFilesForShow(showId: string) {
    return db.riderFiles.where("artist_show_id").equals(showId).toArray();
  }

  async inventoryForStage(stageId: string, festivalId: string): Promise<InventoryItem[]> {
    // Items physically on the stage PLUS the festival's shared pool (stage_id null).
    const all = await db.inventoryItems.where("festival_id").equals(festivalId).toArray();
    return all.filter((i) => i.stage_id === stageId || i.stage_id === null);
  }

  resolutionsForRequirement(requirementId: string) {
    return db.gapResolutions.where("requirement_item_id").equals(requirementId).toArray();
  }

  async latestResolution(requirementId: string): Promise<GapResolution | undefined> {
    const all = await this.resolutionsForRequirement(requirementId);
    return all.sort((a, b) => Date.parse(b.resolved_at) - Date.parse(a.resolved_at))[0];
  }

  async messagesForChannel(channelId: string) {
    const all = await db.chatMessages.where("channel_id").equals(channelId).toArray();
    return all.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  }

  rememberForShow(showId: string) {
    return db.rememberNotes.where("artist_show_id").equals(showId).toArray();
  }
}

export { db };
export type { ArtistShow, RequirementItem };
