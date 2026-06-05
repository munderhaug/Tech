import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Zap } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { computeStagePower } from "@/domain/powerLoad";
import { Badge, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function PowerPage() {
  const { festivalId, stageId } = useApp();
  const data = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const stages = await store.stagesForFestival(festivalId);
    const inventory = (await store.inventoryItems.all()).filter(
      (i) => i.festival_id === festivalId,
    );
    const distros = await store.powerDistros.all();
    return { stages, inventory, distros };
  }, [festivalId]);

  if (!data) return <EmptyState>Loading power…</EmptyState>;
  const stages = stageId ? data.stages.filter((s) => s.id === stageId) : data.stages;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Power / Load</SectionTitle>
      {stages.map((stage) => {
        const summary = computeStagePower(stage.id, data.inventory, data.distros);
        const pct = Math.min(summary.utilization * 100, 130);
        return (
          <Card key={stage.id} className={summary.overdraw ? "border-gap/60" : undefined}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-pending" />
                <span className="font-semibold">{stage.name}</span>
                {summary.overdraw && (
                  <Badge variant="gap" className="ml-auto flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Overdraw
                  </Badge>
                )}
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", summary.overdraw ? "bg-gap" : "bg-met")}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{(summary.drawW / 1000).toFixed(1)} kW draw</span>
                <span>{(summary.capacityW / 1000).toFixed(1)} kW capacity</span>
              </div>
              <p
                className={cn(
                  "mt-1 text-sm",
                  summary.overdraw ? "text-gap" : "text-muted-foreground",
                )}
              >
                {summary.overdraw
                  ? `Over by ${(-summary.headroomW / 1000).toFixed(1)} kW — will trip a breaker.`
                  : `${(summary.headroomW / 1000).toFixed(1)} kW headroom.`}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
