// Power / load calculator (PRD §5.8, AC §9.9).
// Sum equipment draw per stage against available distro capacity; flag overdraw
// before it trips a breaker mid-set.

import type { InventoryItem, PowerDistro } from "./types";

export interface PowerSummary {
  stageId: string;
  capacityW: number;
  drawW: number;
  headroomW: number;
  utilization: number; // 0..1+
  overdraw: boolean;
}

/**
 * Compute the power picture for a stage. `inventory` should be the items physically
 * on the stage; `distros` are the distros feeding it (capacities summed).
 */
export function computeStagePower(
  stageId: string,
  inventory: InventoryItem[],
  distros: PowerDistro[],
): PowerSummary {
  const capacityW = distros
    .filter((d) => d.stage_id === stageId)
    .reduce((sum, d) => sum + d.capacity_w, 0);

  const drawW = inventory
    .filter((i) => i.stage_id === stageId)
    .reduce((sum, i) => sum + i.power_draw_w * i.qty, 0);

  const headroomW = capacityW - drawW;
  return {
    stageId,
    capacityW,
    drawW,
    headroomW,
    utilization: capacityW > 0 ? drawW / capacityW : drawW > 0 ? Infinity : 0,
    overdraw: drawW > capacityW,
  };
}
