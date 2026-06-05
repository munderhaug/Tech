import * as React from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus } from "lucide-react";
import { useApp } from "@/app/AppContext";
import { getStore } from "@/data/store";
import { matchAll, rollupGaps } from "@/domain/gapEngine";
import type { ArtistShow, Stage } from "@/domain/types";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  Select,
  SectionTitle,
} from "@/components/ui/primitives";
import { GapSummary } from "@/features/gaps/GapSummary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmtTime, newId, nowIso } from "@/lib/utils";

function ShowCard({ show }: { show: ArtistShow }) {
  const rollup = useLiveQuery(async () => {
    const store = getStore();
    const reqs = await store.requirementsForShow(show.id);
    const inv = await store.inventoryForStage(show.stage_id, show.festival_id);
    const matches = matchAll(reqs, inv);
    const withStatus = reqs.map((r) => {
      const m = matches.get(r.id)!;
      return { ...r, status: m.status };
    });
    const resolutions = new Map(
      await Promise.all(
        withStatus.map(async (r) => [r.id, await store.latestResolution(r.id)] as const),
      ),
    );
    return rollupGaps(withStatus, resolutions);
  }, [show.id]);

  return (
    <Card>
      <CardContent className="p-3">
        <Link to={`/artists/${show.id}`} className="block">
          <div className="flex items-center justify-between">
            <span className="font-medium">{show.artist_name}</span>
            <span className="text-xs text-muted-foreground">
              {fmtTime(show.set_start)}–{fmtTime(show.set_end)}
            </span>
          </div>
        </Link>
        {rollup && rollup.total > 0 && (
          <div className="mt-3">
            <GapSummary rollup={rollup} to={`/artists/${show.id}/gaps`} />
          </div>
        )}
        {rollup && rollup.total === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No rider parsed yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AddArtistDialog({ stages }: { stages: Stage[] }) {
  const { festivalId } = useApp();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [stageId, setStageId] = React.useState(stages[0]?.id ?? "");
  const [date, setDate] = React.useState("2026-06-20");

  const add = async () => {
    if (!name.trim() || !stageId || !festivalId) return;
    const show: ArtistShow = {
      id: newId(),
      stage_id: stageId,
      festival_id: festivalId,
      artist_name: name.trim(),
      date,
      set_start: null,
      set_end: null,
      changeover_after_min: 30,
      advancing_tm_contact: null,
      client_uuid: newId(),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await getStore().artistShows.put(show);
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add artist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add artist / show</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Artist name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Polar Vortex" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Stage</Label>
            <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={add} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ArtistsPage() {
  const { festivalId, stageId } = useApp();
  const stages = useLiveQuery(
    async () => (festivalId ? getStore().stagesForFestival(festivalId) : []),
    [festivalId],
  );
  const shows = useLiveQuery(async () => {
    if (!festivalId) return [];
    const all = await getStore().showsForFestival(festivalId);
    const filtered = stageId ? all.filter((s) => s.stage_id === stageId) : all;
    return filtered.sort((a, b) => (a.set_start ?? "").localeCompare(b.set_start ?? ""));
  }, [festivalId, stageId]);

  const byStage = new Map<string, ArtistShow[]>();
  for (const s of shows ?? []) {
    byStage.set(s.stage_id, [...(byStage.get(s.stage_id) ?? []), s]);
  }
  const stageName = (id: string) => (stages ?? []).find((s) => s.id === id)?.name ?? "Stage";

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle action={stages && <AddArtistDialog stages={stages} />}>Artists</SectionTitle>

      {(shows?.length ?? 0) === 0 && <EmptyState>No artists for this view yet.</EmptyState>}

      {[...byStage.entries()].map(([sid, list]) => (
        <div key={sid} className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{stageName(sid)}</h3>
          {list.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      ))}
    </div>
  );
}
