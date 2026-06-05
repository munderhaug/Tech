// Resource-conflict detection (PRD §5.3).
// The same physical inventory item assigned to two shows/stages with overlapping
// time windows is a top real-world failure — make the conflict LOUD.

import type { Assignment } from "./types";

export interface ResourceConflict {
  inventoryItemId: string;
  a: Assignment;
  b: Assignment;
  overlapStart: string;
  overlapEnd: string;
}

function overlaps(a: Assignment, b: Assignment): { start: string; end: string } | null {
  const aStart = Date.parse(a.start_time);
  const aEnd = Date.parse(a.end_time);
  const bStart = Date.parse(b.start_time);
  const bEnd = Date.parse(b.end_time);
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  // Strict overlap: touching end-to-start (a ends exactly when b starts) is NOT a conflict.
  if (start < end) {
    return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
  }
  return null;
}

/** Find every pair of assignments of the same inventory item whose windows overlap. */
export function findResourceConflicts(assignments: Assignment[]): ResourceConflict[] {
  const byItem = new Map<string, Assignment[]>();
  for (const a of assignments) {
    const list = byItem.get(a.inventory_item_id) ?? [];
    list.push(a);
    byItem.set(a.inventory_item_id, list);
  }

  const conflicts: ResourceConflict[] = [];
  for (const [inventoryItemId, list] of byItem) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const ov = overlaps(list[i], list[j]);
        if (ov) {
          conflicts.push({
            inventoryItemId,
            a: list[i],
            b: list[j],
            overlapStart: ov.start,
            overlapEnd: ov.end,
          });
        }
      }
    }
  }
  return conflicts;
}

/** Set of inventory_item_ids currently in conflict — handy for UI banners. */
export function conflictedInventoryIds(assignments: Assignment[]): Set<string> {
  return new Set(findResourceConflicts(assignments).map((c) => c.inventoryItemId));
}
