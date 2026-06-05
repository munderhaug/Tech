// Gap Engine — the spine of StageOps.
//
// A requirement line item is matched against the stage's inventory and resolves to:
//   MET       — equivalent or better delivered
//   GAP       — missing, substituted-downgrade, or quantity short
//   OVER_SPEC — providing more than requested (informational)
//   UNMATCHED — no candidate found at all (a special, loud kind of gap)
//
// Matching is DETERMINISTIC first (model match, then category + qty). AI-assisted
// equivalence is a *suggestion* surfaced to a human — never auto-applied here.
//
// Principle: a gap can never be silently cleared. resolveGap() requires a resolution
// type AND a non-empty note, and records who + when.

import type {
  GapResolution,
  InventoryItem,
  NormalizedSpec,
  RequirementItem,
  RequirementStatus,
  ResolutionType,
} from "./types";
import { OPEN_RESOLUTION_TYPES } from "./types";

export interface MatchResult {
  status: RequirementStatus;
  matchedInventoryId: string | null;
  /** Human-readable reason the engine reached this status. */
  reason: string;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Required quantity, defaulting to 1 when the rider didn't specify one. */
export function requiredQty(spec: NormalizedSpec): number {
  return spec.qty && spec.qty > 0 ? spec.qty : 1;
}

/** True when an inventory item is a plausible model-level match for the requirement. */
function isModelMatch(req: RequirementItem, inv: InventoryItem): boolean {
  const model = req.normalized.model;
  if (model && inv.model && norm(inv.model) === norm(model)) return true;
  // Description sometimes carries the model when normalization missed it.
  if (inv.model && norm(req.description).includes(norm(inv.model))) return true;
  return false;
}

/**
 * Deterministically match one requirement against the inventory available to a stage.
 * `available` should already be filtered to the stage + shared pool.
 */
export function matchRequirement(
  req: RequirementItem,
  available: InventoryItem[],
): MatchResult {
  const need = requiredQty(req.normalized);

  // 1) Strongest signal: explicit model match in the same category.
  const modelMatches = available.filter(
    (inv) => inv.category === req.category && isModelMatch(req, inv),
  );
  if (modelMatches.length > 0) {
    const supplied = modelMatches.reduce((sum, inv) => sum + inv.qty, 0);
    const best = modelMatches[0];
    if (supplied < need) {
      return {
        status: "GAP",
        matchedInventoryId: best.id,
        reason: `Quantity short: rider needs ${need}× ${best.model}, ${supplied} delivered.`,
      };
    }
    if (supplied > need) {
      return {
        status: "OVER_SPEC",
        matchedInventoryId: best.id,
        reason: `Over-spec: ${supplied}× ${best.model} delivered for ${need} requested.`,
      };
    }
    return {
      status: "MET",
      matchedInventoryId: best.id,
      reason: `Exact model match: ${supplied}× ${best.model}.`,
    };
  }

  // 2) Category + quantity fallback (something in the right family is present).
  const categoryMatches = available.filter((inv) => inv.category === req.category);
  if (categoryMatches.length > 0) {
    const supplied = categoryMatches.reduce((sum, inv) => sum + inv.qty, 0);
    const best = categoryMatches[0];
    if (supplied < need) {
      return {
        status: "GAP",
        matchedInventoryId: best.id,
        reason: `Quantity short in ${req.category}: need ${need}, ${supplied} on this stage.`,
      };
    }
    // Different model but right category + enough quantity = possible substitute.
    // The engine flags this as a GAP (substituted-downgrade) for a human to confirm,
    // rather than silently calling it MET.
    return {
      status: "GAP",
      matchedInventoryId: best.id,
      reason: `Possible substitute: ${best.make} ${best.model} in ${req.category}, not the requested model. Confirm equivalence.`,
    };
  }

  // 3) Nothing in this category at all.
  return {
    status: "UNMATCHED",
    matchedInventoryId: null,
    reason: `Nothing in ${req.category} on this stage to cover this requirement.`,
  };
}

/** Run the engine across a set of requirements; returns updated status + match per item. */
export function matchAll(
  requirements: RequirementItem[],
  available: InventoryItem[],
): Map<string, MatchResult> {
  const out = new Map<string, MatchResult>();
  for (const req of requirements) {
    out.set(req.id, matchRequirement(req, available));
  }
  return out;
}

// ---- Resolution -----------------------------------------------------------

export class GapResolutionError extends Error {}

export interface ResolveGapInput {
  requirementItemId: string;
  resolutionType: ResolutionType;
  note: string;
  resolvedBy: string;
}

/**
 * Build a validated GapResolution. Throws GapResolutionError if the note is empty
 * or whitespace-only — this is the DB CHECK mirrored in code (AC §9.3).
 */
export function buildGapResolution(
  input: ResolveGapInput,
  now: Date = new Date(),
  idFactory: () => string = cryptoId,
): GapResolution {
  if (!input.resolutionType) {
    throw new GapResolutionError("A resolution type is required to clear a gap.");
  }
  if (!input.note || input.note.trim().length === 0) {
    throw new GapResolutionError("A non-empty reason note is required to clear a gap.");
  }
  if (!input.resolvedBy) {
    throw new GapResolutionError("resolved_by is required.");
  }
  return {
    id: idFactory(),
    requirement_item_id: input.requirementItemId,
    resolution_type: input.resolutionType,
    note: input.note.trim(),
    resolved_by: input.resolvedBy,
    resolved_at: now.toISOString(),
    client_uuid: idFactory(),
  };
}

/** A resolution that leaves the gap visibly OPEN (amber) rather than closed. */
export function isOpenResolution(resolution: GapResolution): boolean {
  return OPEN_RESOLUTION_TYPES.includes(resolution.resolution_type);
}

// ---- Roll-up --------------------------------------------------------------

export interface GapRollup {
  total: number;
  met: number;
  overSpec: number;
  /** Gaps with no resolution at all. */
  openGaps: number;
  /** Gaps whose latest resolution is PENDING / CROSS_RENTAL / CLARIFICATION. */
  amberGaps: number;
  /** Gaps closed with SUBSTITUTED / WONT_PROVIDE. */
  closedGaps: number;
}

/**
 * Per-artist Gap Report rollup. `latestResolution` maps requirement_item_id → its most
 * recent resolution (or undefined if unresolved).
 */
export function rollupGaps(
  requirements: RequirementItem[],
  latestResolution: Map<string, GapResolution | undefined>,
): GapRollup {
  const roll: GapRollup = {
    total: requirements.length,
    met: 0,
    overSpec: 0,
    openGaps: 0,
    amberGaps: 0,
    closedGaps: 0,
  };
  for (const req of requirements) {
    if (req.status === "MET") {
      roll.met++;
      continue;
    }
    if (req.status === "OVER_SPEC") {
      roll.overSpec++;
      continue;
    }
    // GAP or UNMATCHED — look at resolution state.
    const res = latestResolution.get(req.id);
    if (!res) {
      roll.openGaps++;
    } else if (isOpenResolution(res)) {
      roll.amberGaps++;
    } else {
      roll.closedGaps++;
    }
  }
  return roll;
}

/** True when an artist's prep is fully accounted for (no open or amber gaps remain). */
export function isFullyResolved(roll: GapRollup): boolean {
  return roll.openGaps === 0 && roll.amberGaps === 0;
}

function cryptoId(): string {
  // Browser + Node 19+ both expose crypto.randomUUID.
  return globalThis.crypto.randomUUID();
}
