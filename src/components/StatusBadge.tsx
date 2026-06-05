import { Badge } from "@/components/ui/primitives";
import type { RequirementStatus } from "@/domain/types";

const MAP: Record<RequirementStatus, { variant: "met" | "gap" | "overspec" | "outline"; label: string }> = {
  MET: { variant: "met", label: "Met" },
  GAP: { variant: "gap", label: "Gap" },
  OVER_SPEC: { variant: "overspec", label: "Over-spec" },
  UNMATCHED: { variant: "gap", label: "Unmatched" },
};

export function StatusBadge({ status }: { status: RequirementStatus }) {
  const { variant, label } = MAP[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function ConfidenceBadge({ value, threshold = 0.6 }: { value: number; threshold?: number }) {
  const low = value < threshold;
  return (
    <Badge variant={low ? "pending" : "outline"} title={low ? "Low confidence — verify before matching" : undefined}>
      {Math.round(value * 100)}%{low ? " ⚠" : ""}
    </Badge>
  );
}
