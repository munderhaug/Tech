import { matchRequirement } from "@/domain/gapEngine";
import { OPEN_RESOLUTION_TYPES } from "@/domain/types";
import type { GapResolution, InventoryItem, RequirementItem } from "@/domain/types";
import { Badge, Button, Card, CardContent } from "@/components/ui/primitives";
import { ConfidenceBadge, StatusBadge } from "@/components/StatusBadge";
import { ResolveGapDialog } from "./ResolveGapDialog";
import { fmtTime } from "@/lib/utils";

function ResolutionLine({ res }: { res: GapResolution }) {
  const open = OPEN_RESOLUTION_TYPES.includes(res.resolution_type);
  return (
    <div className="mt-2 rounded-md border border-border bg-background p-2 text-xs">
      <div className="flex items-center gap-2">
        <Badge variant={open ? "pending" : "met"}>
          {res.resolution_type.replaceAll("_", " ").toLowerCase()}
        </Badge>
        {open && <span className="text-pending">still open</span>}
        <span className="ml-auto text-muted-foreground">
          {res.resolved_by} · {fmtTime(res.resolved_at)}
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">{res.note}</p>
    </div>
  );
}

export function RequirementList({
  requirements,
  inventory,
  resolutions,
}: {
  requirements: RequirementItem[];
  inventory: InventoryItem[];
  resolutions: Map<string, GapResolution | undefined>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {requirements.map((req) => {
        const match = matchRequirement(req, inventory);
        const res = resolutions.get(req.id);
        const isGap = req.status === "GAP" || req.status === "UNMATCHED";
        const needsAttention = isGap && (!res || OPEN_RESOLUTION_TYPES.includes(res.resolution_type));
        return (
          <Card key={req.id} className={needsAttention ? "border-gap/40" : undefined}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{req.category.replaceAll("_", " ")}</Badge>
                    <StatusBadge status={req.status} />
                    <ConfidenceBadge value={req.confidence} />
                    {req.created_by_ai && (
                      <span className="text-[10px] uppercase text-muted-foreground">AI draft</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{req.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{match.reason}</p>
                  {req.source_ref && (
                    <p className="text-[11px] text-muted-foreground/70">↳ {req.source_ref}</p>
                  )}
                </div>
                {isGap && (
                  <ResolveGapDialog
                    requirement={req}
                    trigger={
                      <Button size="sm" variant={needsAttention ? "default" : "outline"}>
                        {res ? "Update" : "Resolve"}
                      </Button>
                    }
                  />
                )}
              </div>
              {res && <ResolutionLine res={res} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
