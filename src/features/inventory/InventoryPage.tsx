import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { findResourceConflicts } from "@/domain/resourceConflict";
import type { InventoryItem } from "@/domain/types";
import { Badge, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/utils";

export function InventoryPage() {
  const { festivalId, stageId } = useApp();

  const data = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const inventory = await store.inventoryItems.all();
    const assignments = await store.assignments.all();
    const shows = await store.showsForFestival(festivalId);
    const fInv = inventory.filter((i) => i.festival_id === festivalId);
    return { inventory: fInv, assignments, shows };
  }, [festivalId]);

  if (!data) return <EmptyState>Loading inventory…</EmptyState>;

  const conflicts = findResourceConflicts(data.assignments);
  const conflictedIds = new Set(conflicts.map((c) => c.inventoryItemId));
  const showName = (id: string | null) =>
    id ? data.shows.find((s) => s.id === id)?.artist_name ?? id : "—";

  const visible = stageId
    ? data.inventory.filter((i) => i.stage_id === stageId || i.stage_id === null)
    : data.inventory;

  const grouped = new Map<string, InventoryItem[]>();
  for (const i of visible) {
    const key = i.stage_id === null ? "Shared / cross-rental pool" : i.stage_id;
    grouped.set(key, [...(grouped.get(key) ?? []), i]);
  }
  const stages = useLiveQuery(
    async () => (festivalId ? getStore().stagesForFestival(festivalId) : []),
    [festivalId],
  );
  const stageLabel = (key: string) =>
    key.startsWith("stage-")
      ? (stages ?? []).find((s) => s.id === key)?.name ?? key
      : key;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Inventory &amp; Patch</SectionTitle>

      {conflicts.length > 0 && (
        <Card className="border-gap/60 bg-gap/10">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 font-semibold text-gap">
              <AlertTriangle className="h-4 w-4" /> {conflicts.length} resource conflict
              {conflicts.length > 1 ? "s" : ""}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {conflicts.map((c, idx) => {
                const item = data.inventory.find((i) => i.id === c.inventoryItemId);
                return (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">
                      {item ? `${item.make} ${item.model}` : c.inventoryItemId}
                    </span>{" "}
                    double-booked: <strong>{showName(c.a.artist_show_id)}</strong> and{" "}
                    <strong>{showName(c.b.artist_show_id)}</strong> overlap{" "}
                    {fmtTime(c.overlapStart)}–{fmtTime(c.overlapEnd)}.
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {[...grouped.entries()].map(([key, items]) => (
        <div key={key} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{stageLabel(key)}</h3>
          {items.map((i) => (
            <Card key={i.id} className={conflictedIds.has(i.id) ? "border-gap/50" : undefined}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {i.make} {i.model}
                    </span>
                    {conflictedIds.has(i.id) && <Badge variant="gap">conflict</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {i.category.replaceAll("_", " ")} · {i.power_draw_w} W each
                  </p>
                </div>
                <span className="text-lg font-semibold">×{i.qty}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {visible.length === 0 && <EmptyState>No inventory for this view.</EmptyState>}
    </div>
  );
}
