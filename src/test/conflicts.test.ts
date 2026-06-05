import { describe, expect, it } from "vitest";
import { findResourceConflicts } from "@/domain/resourceConflict";
import { analyzeStageDay, changeoverWindowMin } from "@/domain/scheduleConflict";
import { computeStagePower } from "@/domain/powerLoad";
import { findCommsClashes } from "@/domain/commsClash";
import { analyzeRestPeriods, findCoverageGaps } from "@/domain/crewCoverage";
import type {
  ArtistShow,
  Assignment,
  CommsChannel,
  InventoryItem,
  PowerDistro,
  Shift,
} from "@/domain/types";

const asg = (p: Partial<Assignment>): Assignment => ({
  id: "a", inventory_item_id: "inv", stage_id: "s1", artist_show_id: null,
  start_time: "2026-06-20T20:00:00Z", end_time: "2026-06-20T21:00:00Z", client_uuid: "u", ...p,
});

describe("findResourceConflicts (AC §9.4)", () => {
  it("flags the same item double-booked across overlapping windows", () => {
    const conflicts = findResourceConflicts([
      asg({ id: "a1", start_time: "2026-06-20T19:00:00Z", end_time: "2026-06-20T21:15:00Z" }),
      asg({ id: "a2", start_time: "2026-06-20T20:00:00Z", end_time: "2026-06-20T21:45:00Z" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].inventoryItemId).toBe("inv");
  });

  it("does not flag back-to-back (touching) windows", () => {
    const conflicts = findResourceConflicts([
      asg({ id: "a1", start_time: "2026-06-20T19:00:00Z", end_time: "2026-06-20T20:00:00Z" }),
      asg({ id: "a2", start_time: "2026-06-20T20:00:00Z", end_time: "2026-06-20T21:00:00Z" }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it("does not flag different items", () => {
    const conflicts = findResourceConflicts([
      asg({ id: "a1", inventory_item_id: "x" }),
      asg({ id: "a2", inventory_item_id: "y" }),
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

const show = (p: Partial<ArtistShow>): ArtistShow => ({
  id: "sh", stage_id: "s1", festival_id: "f1", artist_name: "A", date: "2026-06-20",
  set_start: null, set_end: null, changeover_after_min: null, advancing_tm_contact: null,
  client_uuid: "u", created_at: "", updated_at: "", ...p,
});

describe("analyzeStageDay (AC §9.5)", () => {
  it("flags an impossible changeover when the flip window is too short", () => {
    const issues = analyzeStageDay([
      show({ id: "1", artist_name: "Aurora", set_start: "2026-06-20T20:00:00Z", set_end: "2026-06-20T21:00:00Z", changeover_after_min: 45 }),
      show({ id: "2", artist_name: "Glacier", set_start: "2026-06-20T21:20:00Z", set_end: "2026-06-20T22:30:00Z", changeover_after_min: 30 }),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("TIGHT_CHANGEOVER");
    expect(issues[0].gapMin).toBe(20);
  });

  it("flags overlapping sets", () => {
    const issues = analyzeStageDay([
      show({ id: "1", set_start: "2026-06-20T20:00:00Z", set_end: "2026-06-20T21:00:00Z", changeover_after_min: 0 }),
      show({ id: "2", set_start: "2026-06-20T20:30:00Z", set_end: "2026-06-20T21:30:00Z", changeover_after_min: 0 }),
    ]);
    expect(issues[0].kind).toBe("OVERLAP");
  });

  it("reports the changeover window between consecutive shows", () => {
    const shows = [
      show({ id: "1", set_start: "2026-06-20T20:00:00Z", set_end: "2026-06-20T21:00:00Z" }),
      show({ id: "2", set_start: "2026-06-20T21:20:00Z", set_end: "2026-06-20T22:30:00Z" }),
    ];
    expect(changeoverWindowMin(shows, "1")).toBe(20);
    expect(changeoverWindowMin(shows, "2")).toBeNull();
  });
});

describe("computeStagePower (AC §9.9)", () => {
  const distros: PowerDistro[] = [{ id: "d", stage_id: "s1", name: "A", capacity_w: 24000 }];
  const item = (qty: number, draw: number): InventoryItem => ({
    id: Math.random().toString(), festival_id: "f1", stage_id: "s1", category: "LIGHTING",
    make: "m", model: "x", qty, power_draw_w: draw, spec: {}, client_uuid: "u",
  });

  it("flags overdraw when draw exceeds capacity", () => {
    const summary = computeStagePower("s1", [item(16, 1000), item(16, 670)], distros);
    expect(summary.drawW).toBe(26720);
    expect(summary.overdraw).toBe(true);
  });

  it("does not flag within capacity", () => {
    const summary = computeStagePower("s1", [item(4, 1000)], distros);
    expect(summary.overdraw).toBe(false);
    expect(summary.headroomW).toBe(20000);
  });
});

describe("findCommsClashes (AC §9.9)", () => {
  const c = (id: string, ch: string): CommsChannel => ({
    id, festival_id: "f1", rf_channel: ch, assigned_to: id, department: "GENERAL",
  });
  it("flags a reused RF channel", () => {
    const clashes = findCommsClashes([c("1", "CH1"), c("2", "CH2"), c("3", "CH2")]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].rfChannel).toBe("CH2");
  });
  it("ignores unique channels", () => {
    expect(findCommsClashes([c("1", "CH1"), c("2", "CH2")])).toHaveLength(0);
  });
});

describe("crew coverage & rest periods (AC §9.7)", () => {
  const shift = (p: Partial<Shift>): Shift => ({
    id: "sh", crew_member_id: "c1", stage_id: "s1",
    start_time: "2026-06-20T14:00:00Z", end_time: "2026-06-20T23:30:00Z",
    call_time: "2026-06-20T14:00:00Z", breaks: [], client_uuid: "u", ...p,
  });

  it("warns on a long shift with no break", () => {
    const warnings = analyzeRestPeriods([shift({})]);
    expect(warnings.some((w) => w.kind === "NO_BREAK")).toBe(true);
  });

  it("flags a coverage gap in an uncovered sub-window", () => {
    const gaps = findCoverageGaps(
      [shift({ start_time: "2026-06-20T14:00:00Z", end_time: "2026-06-20T18:00:00Z" })],
      "s1",
      "2026-06-20T14:00:00Z",
      "2026-06-20T22:00:00Z",
      1,
    );
    expect(gaps.length).toBeGreaterThan(0);
  });
});
