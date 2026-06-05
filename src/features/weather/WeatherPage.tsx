import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { WEATHER_STATUSES, type Stage, type WeatherStatus, type WeatherStatusRow } from "@/domain/types";
import { Button, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { cn, fmtTime, newId, nowIso } from "@/lib/utils";

const STATUS_STYLE: Record<WeatherStatus, string> = {
  GO: "bg-met/20 text-met border-met/50",
  HOLD: "bg-pending/20 text-pending border-pending/50",
  STOP: "bg-gap/20 text-gap border-gap/50",
};

function StageWeather({ stage, row }: { stage: Stage; row?: WeatherStatusRow }) {
  const { user } = useApp();
  const status = row?.status ?? "GO";

  const setStatus = async (next: WeatherStatus) => {
    const updated: WeatherStatusRow = {
      id: row?.id ?? newId(),
      stage_id: stage.id,
      status: next,
      note: row?.note ?? "",
      updated_by: user.name,
      updated_at: nowIso(),
    };
    await getStore().weatherStatuses.put(updated);
  };

  return (
    <Card className={cn("border-2", STATUS_STYLE[status])}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{stage.name}</span>
          <span className="text-3xl font-black tracking-tight">{status}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {WEATHER_STATUSES.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === status ? "default" : "outline"}
              onClick={() => setStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        {row && (
          <p className="mt-2 text-xs text-muted-foreground">
            {row.note && `${row.note} · `}
            {row.updated_by} at {fmtTime(row.updated_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function WeatherPage() {
  const { festivalId } = useApp();
  const data = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const stages = (await store.stagesForFestival(festivalId)).filter((s) => s.is_outdoor);
    const rows = await store.weatherStatuses.all();
    return { stages, rows };
  }, [festivalId]);

  if (!data) return <EmptyState>Loading…</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Weather / Contingency</SectionTitle>
      <p className="text-xs text-muted-foreground">
        Shared GO / HOLD / STOP for outdoor stages — visible to everyone instantly.
      </p>
      {data.stages.map((stage) => (
        <StageWeather
          key={stage.id}
          stage={stage}
          row={data.rows.find((r) => r.stage_id === stage.id)}
        />
      ))}
      {data.stages.length === 0 && <EmptyState>No outdoor stages.</EmptyState>}
    </div>
  );
}
