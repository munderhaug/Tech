import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { DEFAULT_WORKING_TIME_RULES, analyzeRestPeriods } from "@/domain/crewCoverage";
import type { Shift } from "@/domain/types";
import { Badge, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/utils";

export function CrewPage() {
  const { festivalId, stageId } = useApp();
  const data = useLiveQuery(async () => {
    if (!festivalId) return null;
    const store = getStore();
    const crew = (await store.crewMembers.all()).filter((c) => c.festival_id === festivalId);
    const shifts = await store.shifts.all();
    return { crew, shifts };
  }, [festivalId]);

  if (!data) return <EmptyState>Loading crew…</EmptyState>;

  const shifts = stageId ? data.shifts.filter((s) => s.stage_id === stageId) : data.shifts;
  const warnings = analyzeRestPeriods(shifts);
  const shiftsByMember = new Map<string, Shift[]>();
  for (const s of shifts) {
    shiftsByMember.set(s.crew_member_id, [...(shiftsByMember.get(s.crew_member_id) ?? []), s]);
  }
  const warningsFor = (memberId: string) =>
    warnings.filter((w) => w.crewMemberId === memberId);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Crew &amp; Time</SectionTitle>
      <p className="text-xs text-muted-foreground">
        Rest-period thresholds ({DEFAULT_WORKING_TIME_RULES.minRestBetweenShiftsMin / 60}h rest,{" "}
        {DEFAULT_WORKING_TIME_RULES.maxShiftBeforeBreakMin / 60}h before break) are placeholders —
        confirm Norway/EU rules before relying on them.
      </p>

      {data.crew.map((member) => {
        const ms = shiftsByMember.get(member.id) ?? [];
        const ws = warningsFor(member.id);
        return (
          <Card key={member.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{member.name}</span>
                <Badge variant="outline">{member.role.replaceAll("_", " ").toLowerCase()}</Badge>
                <Badge>{member.department.toLowerCase()}</Badge>
              </div>
              {ms.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No shifts assigned.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-1">
                  {ms.map((s) => (
                    <div key={s.id} className="text-sm text-muted-foreground">
                      Call {fmtTime(s.call_time)} · {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                      {s.breaks.length > 0 ? ` · ${s.breaks.length} break(s)` : " · no break"}
                    </div>
                  ))}
                </div>
              )}
              {ws.map((w, i) => (
                <div key={i} className="mt-1 flex items-center gap-1 text-xs text-pending">
                  <AlertTriangle className="h-3 w-3" /> {w.message}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
      {data.crew.length === 0 && <EmptyState>No crew yet.</EmptyState>}
    </div>
  );
}
