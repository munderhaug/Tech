import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ArrowDown } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { analyzeStageDay } from "@/domain/scheduleConflict";
import type { ArtistShow, Stage } from "@/domain/types";
import { Badge, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { cn, fmtTime } from "@/lib/utils";

function StageDay({ stage, shows }: { stage: Stage; shows: ArtistShow[] }) {
  const timed = shows
    .filter((s) => s.set_start && s.set_end)
    .sort((a, b) => Date.parse(a.set_start!) - Date.parse(b.set_start!));
  const issues = analyzeStageDay(shows);
  const issueFor = (showId: string) => issues.find((i) => i.showId === showId);

  return (
    <Card>
      <CardContent className="p-3">
        <h3 className="mb-2 font-semibold">
          {stage.name}{" "}
          {stage.is_outdoor && <Badge variant="outline">outdoor</Badge>}
        </h3>
        {timed.length === 0 && (
          <p className="text-sm text-muted-foreground">No set times scheduled.</p>
        )}
        {timed.map((show, idx) => {
          const issue = issueFor(show.id);
          const next = timed[idx + 1];
          return (
            <div key={show.id}>
              <Link
                to={`/artists/${show.id}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background p-2"
              >
                <div className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                  {fmtTime(show.set_start)}–{fmtTime(show.set_end)}
                </div>
                <span className="font-medium">{show.artist_name}</span>
              </Link>
              {next && (
                <div
                  className={cn(
                    "my-1 ml-3 flex items-center gap-2 text-xs",
                    issue ? "text-gap" : "text-muted-foreground",
                  )}
                >
                  <ArrowDown className="h-3 w-3" />
                  {issue ? (
                    <span className="flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      {issue.kind === "OVERLAP"
                        ? `Sets overlap by ${-issue.gapMin} min`
                        : `Tight changeover: ${issue.gapMin} min (need ${issue.requiredMin})`}
                    </span>
                  ) : (
                    <span>
                      Changeover {show.changeover_after_min ?? "?"} min
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SchedulePage() {
  const { festivalId, stageId } = useApp();
  const data = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const stages = await store.stagesForFestival(festivalId);
    const shows = await store.showsForFestival(festivalId);
    return { stages, shows };
  }, [festivalId]);

  if (!data) return <EmptyState>Loading schedule…</EmptyState>;
  const stages = stageId ? data.stages.filter((s) => s.id === stageId) : data.stages;

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Day Sheet</SectionTitle>
      <p className="text-xs text-muted-foreground">
        Changeover windows are explicit; impossible flips are flagged in red.
      </p>
      {stages.map((stage) => (
        <StageDay
          key={stage.id}
          stage={stage}
          shows={data.shows.filter((s) => s.stage_id === stage.id)}
        />
      ))}
    </div>
  );
}
