import { describe, expect, it } from "vitest";
import {
  GapResolutionError,
  buildGapResolution,
  isFullyResolved,
  matchRequirement,
  rollupGaps,
} from "@/domain/gapEngine";
import type { GapResolution, InventoryItem, RequirementItem } from "@/domain/types";

function req(partial: Partial<RequirementItem>): RequirementItem {
  return {
    id: "r1",
    artist_show_id: "show1",
    rider_file_id: null,
    category: "SOUND_FOH",
    description: "test",
    normalized: {},
    confidence: 0.9,
    source_ref: null,
    status: "UNMATCHED",
    matched_inventory_id: null,
    created_by_ai: true,
    client_uuid: "u",
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

function inv(partial: Partial<InventoryItem>): InventoryItem {
  return {
    id: "i1",
    festival_id: "f1",
    stage_id: "s1",
    category: "SOUND_FOH",
    make: "DiGiCo",
    model: "SD12",
    qty: 1,
    power_draw_w: 0,
    spec: {},
    client_uuid: "u",
    ...partial,
  };
}

describe("matchRequirement", () => {
  it("returns MET on exact model match with sufficient qty", () => {
    const r = req({ normalized: { qty: 1, model: "SD12" } });
    const result = matchRequirement(r, [inv({ model: "SD12", qty: 1 })]);
    expect(result.status).toBe("MET");
    expect(result.matchedInventoryId).toBe("i1");
  });

  it("returns GAP when quantity is short for a model match", () => {
    const r = req({ category: "SOUND_INPUTS", normalized: { qty: 12, model: "SM58" } });
    const result = matchRequirement(r, [
      inv({ id: "x", category: "SOUND_INPUTS", model: "SM58", qty: 8 }),
    ]);
    expect(result.status).toBe("GAP");
  });

  it("returns OVER_SPEC when more is delivered than requested", () => {
    const r = req({ normalized: { qty: 12, model: "K2" } });
    const result = matchRequirement(r, [inv({ model: "K2", qty: 16 })]);
    expect(result.status).toBe("OVER_SPEC");
  });

  it("flags a different model in-category as a GAP needing human confirmation", () => {
    const r = req({ category: "SOUND_MON", normalized: { qty: 6, model: "X12" } });
    const result = matchRequirement(r, [
      inv({ id: "w", category: "SOUND_MON", make: "d&b", model: "M4", qty: 8 }),
    ]);
    expect(result.status).toBe("GAP");
    expect(result.reason).toMatch(/substitute/i);
  });

  it("returns UNMATCHED when nothing in the category exists", () => {
    const r = req({ category: "LIGHTING", normalized: { qty: 8 } });
    const result = matchRequirement(r, [inv({ category: "SOUND_FOH" })]);
    expect(result.status).toBe("UNMATCHED");
    expect(result.matchedInventoryId).toBeNull();
  });
});

describe("buildGapResolution (AC §9.3 — no silent clearing)", () => {
  const base = {
    requirementItemId: "r1",
    resolutionType: "SUBSTITUTED" as const,
    resolvedBy: "Lars",
  };

  it("rejects an empty note", () => {
    expect(() => buildGapResolution({ ...base, note: "" })).toThrow(GapResolutionError);
    expect(() => buildGapResolution({ ...base, note: "   " })).toThrow(GapResolutionError);
  });

  it("rejects a missing resolver", () => {
    expect(() =>
      buildGapResolution({ ...base, note: "ok", resolvedBy: "" }),
    ).toThrow(GapResolutionError);
  });

  it("builds a resolution recording who + when on valid input", () => {
    const res = buildGapResolution(
      { ...base, note: "  Swapped for equivalent M32  " },
      new Date("2026-06-20T12:00:00Z"),
      () => "id-1",
    );
    expect(res.note).toBe("Swapped for equivalent M32");
    expect(res.resolved_by).toBe("Lars");
    expect(res.resolved_at).toBe("2026-06-20T12:00:00.000Z");
  });
});

describe("rollupGaps", () => {
  const reqs = [
    req({ id: "a", status: "MET" }),
    req({ id: "b", status: "OVER_SPEC" }),
    req({ id: "c", status: "GAP" }), // unresolved
    req({ id: "d", status: "GAP" }), // amber
    req({ id: "e", status: "UNMATCHED" }), // closed
  ];
  const resolutions = new Map<string, GapResolution | undefined>([
    ["c", undefined],
    ["d", { resolution_type: "PENDING" } as GapResolution],
    ["e", { resolution_type: "WONT_PROVIDE" } as GapResolution],
  ]);

  it("counts statuses and resolution states", () => {
    const roll = rollupGaps(reqs, resolutions);
    expect(roll).toMatchObject({
      total: 5,
      met: 1,
      overSpec: 1,
      openGaps: 1,
      amberGaps: 1,
      closedGaps: 1,
    });
    expect(isFullyResolved(roll)).toBe(false);
  });

  it("is fully resolved only when no open or amber gaps remain", () => {
    const roll = rollupGaps(
      [req({ id: "x", status: "GAP" })],
      new Map([["x", { resolution_type: "SUBSTITUTED" } as GapResolution]]),
    );
    expect(isFullyResolved(roll)).toBe(true);
  });
});
