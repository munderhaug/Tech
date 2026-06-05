import { Link } from "react-router-dom";
import type { GapRollup } from "@/domain/gapEngine";
import { isFullyResolved } from "@/domain/gapEngine";
import { cn } from "@/lib/utils";

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-border bg-background px-2 py-1.5">
      <span className={cn("text-lg font-semibold leading-none", className)}>{value}</span>
      <span className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</span>
    </div>
  );
}

export function GapSummary({ rollup, to }: { rollup: GapRollup; to?: string }) {
  const body = (
    <div className="grid grid-cols-5 gap-2">
      <Stat label="Met" value={rollup.met} className="text-met" />
      <Stat label="Over" value={rollup.overSpec} className="text-overspec" />
      <Stat label="Open" value={rollup.openGaps} className="text-gap" />
      <Stat label="Amber" value={rollup.amberGaps} className="text-pending" />
      <Stat label="Closed" value={rollup.closedGaps} className="text-muted-foreground" />
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      {to ? (
        <Link to={to} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
      {rollup.total > 0 && (
        <p className="text-xs text-muted-foreground">
          {isFullyResolved(rollup)
            ? "✓ All requirements accounted for."
            : `${rollup.openGaps + rollup.amberGaps} item(s) still need attention.`}
        </p>
      )}
    </div>
  );
}
