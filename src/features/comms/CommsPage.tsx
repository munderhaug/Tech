import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Radio } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { clashedChannels, findCommsClashes } from "@/domain/commsClash";
import { Badge, Card, CardContent, EmptyState, SectionTitle } from "@/components/ui/primitives";

export function CommsPage() {
  const { festivalId } = useApp();
  const channels = useLiveQuery(async () => {
    if (!festivalId) return [];
    return (await getStore().commsChannels.all()).filter((c) => c.festival_id === festivalId);
  }, [festivalId]);

  if (!channels) return <EmptyState>Loading comms…</EmptyState>;

  const clashes = findCommsClashes(channels);
  const clashedIds = clashedChannels(channels);

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle>Walkie / Comms Map</SectionTitle>

      {clashes.length > 0 && (
        <Card className="border-gap/60 bg-gap/10">
          <CardContent className="flex items-center gap-2 p-3 text-sm font-medium text-gap">
            <AlertTriangle className="h-4 w-4" />
            {clashes.length} channel clash{clashes.length > 1 ? "es" : ""} — reassign before doors.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {channels.map((c) => (
          <Card key={c.id} className={clashedIds.has(c.id) ? "border-gap/50" : undefined}>
            <CardContent className="flex items-center gap-3 p-3">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono font-semibold">{c.rf_channel}</span>
              <span className="text-sm">{c.assigned_to}</span>
              <Badge variant="outline" className="ml-auto">
                {c.department.toLowerCase()}
              </Badge>
              {clashedIds.has(c.id) && <Badge variant="gap">clash</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>
      {channels.length === 0 && <EmptyState>No comms channels assigned.</EmptyState>}
    </div>
  );
}
