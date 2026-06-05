// End-to-end through the real data layer (Dexie on fake-indexeddb): seed the demo, then
// assert every rigged flag actually fires via the same code paths the UI uses.

import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/data/local/db";
import { LocalDataStore } from "@/data/local/localStore";
import { setDataStore, getStore } from "@/data/store";
import { seedIfEmpty, SEED_IDS } from "@/data/seed";
import { matchAll, rollupGaps } from "@/domain/gapEngine";
import { findResourceConflicts } from "@/domain/resourceConflict";
import { analyzeStageDay } from "@/domain/scheduleConflict";
import { computeStagePower } from "@/domain/powerLoad";
import { findCommsClashes } from "@/domain/commsClash";

beforeAll(async () => {
  setDataStore(new LocalDataStore());
  await seedIfEmpty();
});

describe("demo seed integration", () => {
  it("is idempotent (seeding twice keeps one festival)", async () => {
    await seedIfEmpty();
    expect(await db.festivals.count()).toBe(1);
  });

  it("produces a GAP, an OVER_SPEC, and an UNMATCHED for Aurora via the live engine", async () => {
    const store = getStore();
    const show = (await store.artistShows.get(SEED_IDS.AURORA))!;
    const reqs = await store.requirementsForShow(show.id);
    const inv = await store.inventoryForStage(show.stage_id, show.festival_id);
    const matches = matchAll(reqs, inv);
    const statuses = [...matches.values()].map((m) => m.status);

    expect(statuses).toContain("MET"); // SD12 from shared pool
    expect(statuses).toContain("GAP"); // 12 SM58 requested, 8 delivered
    expect(statuses).toContain("OVER_SPEC"); // 12 K2 requested, 16 delivered
    expect(statuses).toContain("UNMATCHED"); // moving heads — nothing in LIGHTING? (Robe exists)

    const roll = rollupGaps(
      reqs.map((r) => ({ ...r, status: matches.get(r.id)!.status })),
      new Map(),
    );
    expect(roll.openGaps).toBeGreaterThan(0);
  });

  it("detects the shared-console resource conflict", async () => {
    const conflicts = findResourceConflicts(await getStore().assignments.all());
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts.some((c) => c.inventoryItemId === "inv-sd12")).toBe(true);
  });

  it("flags the impossible changeover on the main stage", async () => {
    const shows = await getStore().showsForStage(SEED_IDS.MAIN);
    const issues = analyzeStageDay(shows);
    expect(issues.some((i) => i.kind === "TIGHT_CHANGEOVER")).toBe(true);
  });

  it("flags a power overdraw on the main stage", async () => {
    const store = getStore();
    const inv = (await store.inventoryItems.all());
    const distros = await store.powerDistros.all();
    expect(computeStagePower(SEED_IDS.MAIN, inv, distros).overdraw).toBe(true);
  });

  it("flags a comms channel clash", async () => {
    const clashes = findCommsClashes(await getStore().commsChannels.all());
    expect(clashes.length).toBeGreaterThanOrEqual(1);
  });
});
