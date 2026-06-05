import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useGapData } from "./useGaps";
import { GapSummary } from "./GapSummary";
import { RequirementList } from "./RequirementList";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";

export function GapReportPage() {
  const { showId } = useParams();
  const data = useGapData(showId);

  if (!data?.show) return <EmptyState>Loading gap report…</EmptyState>;

  // Order: gaps needing attention first, then over-spec, then met.
  const order = { GAP: 0, UNMATCHED: 0, OVER_SPEC: 1, MET: 2 } as const;
  const sorted = [...data.requirements].sort(
    (a, b) => order[a.status] - order[b.status] || b.confidence - a.confidence,
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        to={`/artists/${data.show.id}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {data.show.artist_name}
      </Link>

      <SectionTitle>Gap Report</SectionTitle>
      <GapSummary rollup={data.rollup} />

      {data.requirements.length === 0 ? (
        <EmptyState>
          No requirements yet. Upload a rider on the artist page to populate this report.
        </EmptyState>
      ) : (
        <RequirementList
          requirements={sorted}
          inventory={data.inventory}
          resolutions={data.resolutions}
        />
      )}
    </div>
  );
}
