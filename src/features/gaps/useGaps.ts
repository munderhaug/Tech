// Shared gap data for a show: requirements + live match results against stage inventory +
// latest resolution per item + the rollup. Used by the Artist Page and the Gap Report.

import { useLiveQuery } from "dexie-react-hooks";
import { getStore } from "@/data/store";
import {
  buildGapResolution,
  matchAll,
  rollupGaps,
  type ResolveGapInput,
} from "@/domain/gapEngine";
import type {
  ArtistShow,
  GapResolution,
  InventoryItem,
  RequirementItem,
} from "@/domain/types";
import type { CurrentUser } from "@/app/AppContext";

export interface GapData {
  show?: ArtistShow;
  requirements: RequirementItem[];
  inventory: InventoryItem[];
  /** requirement_item_id → latest resolution (if any). */
  resolutions: Map<string, GapResolution | undefined>;
  rollup: ReturnType<typeof rollupGaps>;
}

export function useGapData(showId: string | undefined): GapData | undefined {
  return useLiveQuery(async () => {
    if (!showId) return undefined;
    const store = getStore();
    const show = await store.artistShows.get(showId);
    if (!show) return undefined;

    const requirements = await store.requirementsForShow(showId);
    const inventory = await store.inventoryForStage(show.stage_id, show.festival_id);

    // Recompute statuses live so the UI reflects current inventory (engine is the source of truth).
    const matches = matchAll(requirements, inventory);
    const withStatus = requirements.map((r) => {
      const m = matches.get(r.id);
      return m ? { ...r, status: m.status, matched_inventory_id: m.matchedInventoryId } : r;
    });

    const resolutions = new Map<string, GapResolution | undefined>();
    for (const r of withStatus) {
      resolutions.set(r.id, await store.latestResolution(r.id));
    }

    return {
      show,
      requirements: withStatus,
      inventory,
      resolutions,
      rollup: rollupGaps(withStatus, resolutions),
    };
  }, [showId]);
}

/** Persist a gap resolution (validates note + records who/when via the gap engine). */
export async function resolveGap(
  input: Omit<ResolveGapInput, "resolvedBy">,
  user: CurrentUser,
): Promise<void> {
  const resolution = buildGapResolution({ ...input, resolvedBy: user.name });
  await getStore().gapResolutions.put(resolution);
}
