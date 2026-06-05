import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cloud,
  Package,
  Radio,
  Zap,
} from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { matchAll, rollupGaps } from "@/domain/gapEngine";
import { findResourceConflicts } from "@/domain/resourceConflict";
import { analyzeStageDay } from "@/domain/scheduleConflict";
import { computeStagePower } from "@/domain/powerLoad";
import { findCommsClashes } from "@/domain/commsClash";
import { Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

interface Flag {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  to: string;
}

export function DashboardPage() {
  const { festivalId } = useApp();

  const summary = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const stages = await store.stagesForFestival(festivalId);
    const shows = await store.showsForFestival(festivalId);
    const inventory = (await store.inventoryItems.all()).filter(
      (i) => i.festival_id === festivalId,
    );
    const assignments = await store.assignments.all();
    const distros = await store.powerDistros.all();
    const comms = (await store.commsChannels.all()).filter((c) => c.festival_id === festivalId);

    // Aggregate open + amber gaps across every show.
    let openGaps = 0;
    let total = 0;
    for (const show of shows) {
      const reqs = await store.requirementsForShow(show.id);
      total += reqs.length;
      const inv = inventory.filter(
        (i) => i.stage_id === show.stage_id || i.stage_id === null,
      );
      const matches = matchAll(reqs, inv);
      const withStatus = reqs.map((r) => ({ ...r, status: matches.get(r.id)!.status }));
      const resolutions = new Map(
        await Promise.all(
          withStatus.map(async (r) => [r.id, await store.latestResolution(r.id)] as const),
        ),
      );
      const roll = rollupGaps(withStatus, resolutions);
      openGaps += roll.openGaps + roll.amberGaps;
    }

    const conflicts = findResourceConflicts(assignments).length;
    const scheduleIssues = stages.reduce(
      (n, s) => n + analyzeStageDay(shows.filter((x) => x.stage_id === s.id)).length,
      0,
    );
    const overdraws = stages.filter(
      (s) => computeStagePower(s.id, inventory, distros).overdraw,
    ).length;
    const commsClashes = findCommsClashes(comms).length;

    return { openGaps, total, conflicts, scheduleIssues, overdraws, commsClashes, shows };
  }, [festivalId]);

  if (!summary) return <EmptyState>Loading…</EmptyState>;

  const flags: Flag[] = [
    { icon: AlertTriangle, label: "Open / amber gaps", count: summary.openGaps, to: "/artists" },
    { icon: Package, label: "Resource conflicts", count: summary.conflicts, to: "/inventory" },
    { icon: Calendar, label: "Schedule issues", count: summary.scheduleIssues, to: "/schedule" },
    { icon: Zap, label: "Power overdraws", count: summary.overdraws, to: "/power" },
    { icon: Radio, label: "Comms clashes", count: summary.commsClashes, to: "/comms" },
  ];
  const allClear = flags.every((f) => f.count === 0);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Dashboard</SectionTitle>

      {allClear ? (
        <Card className="border-met/50 bg-met/10">
          <CardContent className="flex items-center gap-2 p-4 text-met">
            <CheckCircle2 className="h-5 w-5" /> All clear — no open flags across the site.
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Live count of everything that needs a human before doors.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {flags.map((f) => (
          <Link key={f.label} to={f.to}>
            <Card
              className={cn(
                "h-full",
                f.count > 0 ? "border-gap/50 bg-gap/5" : "border-border",
              )}
            >
              <CardContent className="flex flex-col gap-1 p-3">
                <f.icon
                  className={cn("h-5 w-5", f.count > 0 ? "text-gap" : "text-muted-foreground")}
                />
                <span className={cn("text-2xl font-bold", f.count > 0 && "text-gap")}>
                  {f.count}
                </span>
                <span className="text-xs text-muted-foreground">{f.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Link to="/weather">
          <Card className="h-full">
            <CardContent className="flex flex-col gap-1 p-3">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{summary.shows.length}</span>
              <span className="text-xs text-muted-foreground">Shows · weather board</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
