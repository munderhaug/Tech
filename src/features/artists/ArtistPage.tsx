import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText, Plus, Upload } from "lucide-react";
import { getStore } from "@/data/store";
import { useApp } from "@/app/AppContext";
import { useGapData } from "@/features/gaps/useGaps";
import { GapSummary } from "@/features/gaps/GapSummary";
import { RequirementList } from "@/features/gaps/RequirementList";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PostShowNote, RememberNote } from "@/domain/types";
import { fmtTime, newId, nowIso } from "@/lib/utils";

function RememberNotes({ showId }: { showId: string }) {
  const { user } = useApp();
  const notes = useLiveQuery(() => getStore().rememberForShow(showId), [showId]);
  const [body, setBody] = React.useState("");

  const add = async () => {
    if (!body.trim()) return;
    const note: RememberNote = {
      id: newId(),
      artist_show_id: showId,
      body: body.trim(),
      author: user.name,
      created_at: nowIso(),
      client_uuid: newId(),
    };
    await getStore().rememberNotes.put(note);
    setBody("");
  };

  return (
    <Card>
      <CardContent className="p-3">
        <h3 className="text-sm font-semibold">Things to remember</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Tribal knowledge — adapters, who to talk to, quirks.
        </p>
        <div className="flex flex-col gap-2">
          {(notes ?? []).map((n) => (
            <div key={n.id} className="rounded-md border border-border bg-background p-2 text-sm">
              {n.body}
              <div className="mt-1 text-[11px] text-muted-foreground">— {n.author}</div>
            </div>
          ))}
          {(notes?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">Nothing noted yet.</p>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note…"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button size="icon" onClick={add} aria-label="Add note">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PostShowNotes({ showId }: { showId: string }) {
  const { user } = useApp();
  const notes = useLiveQuery(
    () => getStore().postShowNotes.all().then((all) => all.filter((n) => n.artist_show_id === showId)),
    [showId],
  );
  const [body, setBody] = React.useState("");

  const add = async () => {
    if (!body.trim()) return;
    const note: PostShowNote = {
      id: newId(),
      artist_show_id: showId,
      body: body.trim(),
      author: user.name,
      created_at: nowIso(),
      client_uuid: newId(),
    };
    await getStore().postShowNotes.put(note);
    setBody("");
  };

  return (
    <Card>
      <CardContent className="p-3">
        <h3 className="text-sm font-semibold">Post-show notes</h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Carry-forward for next year (feeds the v2 debrief).
        </p>
        {(notes ?? []).map((n) => (
          <div key={n.id} className="mb-2 rounded-md border border-border bg-background p-2 text-sm">
            {n.body}
            <div className="mt-1 text-[11px] text-muted-foreground">— {n.author}</div>
          </div>
        ))}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened, what to change next time…"
        />
        <Button className="mt-2" size="sm" onClick={add} disabled={!body.trim()}>
          Save note
        </Button>
      </CardContent>
    </Card>
  );
}

export function ArtistPage() {
  const { showId } = useParams();
  const data = useGapData(showId);
  const files = useLiveQuery(
    () => (showId ? getStore().riderFilesForShow(showId) : Promise.resolve([])),
    [showId],
  );

  if (!data?.show) return <EmptyState>Loading artist…</EmptyState>;
  const show = data.show;

  // Patch / input list = the SOUND_INPUTS requirements.
  const patch = data.requirements.filter((r) => r.category === "SOUND_INPUTS");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link to="/artists" className="text-sm text-muted-foreground hover:text-foreground">
          ← Artists
        </Link>
        <h1 className="mt-1 text-xl font-bold">{show.artist_name}</h1>
        <p className="text-sm text-muted-foreground">
          {fmtTime(show.set_start)}–{fmtTime(show.set_end)}
          {show.changeover_after_min != null && ` · ${show.changeover_after_min} min changeover`}
        </p>
        {show.advancing_tm_contact && (
          <p className="mt-1 text-xs text-muted-foreground">
            Advancing TM (internal): {show.advancing_tm_contact}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Gap status</h3>
            <Link to={`/artists/${show.id}/gaps`} className="text-xs text-primary">
              Full report →
            </Link>
          </div>
          <GapSummary rollup={data.rollup} to={`/artists/${show.id}/gaps`} />
        </CardContent>
      </Card>

      <Tabs defaultValue="reqs">
        <TabsList>
          <TabsTrigger value="reqs">Requirements</TabsTrigger>
          <TabsTrigger value="remember">Remember</TabsTrigger>
          <TabsTrigger value="patch">Patch</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="post">Post-show</TabsTrigger>
        </TabsList>

        <TabsContent value="reqs">
          <div className="mb-2 flex justify-end">
            <Button asChild size="sm" variant="outline">
              <Link to={`/artists/${show.id}/intake`}>
                <Upload className="h-4 w-4" /> Rider intake
              </Link>
            </Button>
          </div>
          {data.requirements.length === 0 ? (
            <EmptyState>
              No requirements yet.{" "}
              <Link to={`/artists/${show.id}/intake`} className="text-primary">
                Upload a rider
              </Link>{" "}
              to extract line items.
            </EmptyState>
          ) : (
            <RequirementList
              requirements={data.requirements}
              inventory={data.inventory}
              resolutions={data.resolutions}
            />
          )}
        </TabsContent>

        <TabsContent value="remember">
          <RememberNotes showId={show.id} />
        </TabsContent>

        <TabsContent value="patch">
          {patch.length === 0 ? (
            <EmptyState>No input-list items parsed yet.</EmptyState>
          ) : (
            <Card>
              <CardContent className="p-3">
                <h3 className="mb-2 text-sm font-semibold">Input list</h3>
                <ol className="flex flex-col gap-1 text-sm">
                  {patch.map((p, i) => (
                    <li key={p.id} className="flex gap-2 border-b border-border/50 py-1">
                      <span className="w-6 text-right text-muted-foreground">{i + 1}</span>
                      <span>{p.description}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="files">
          {(files?.length ?? 0) === 0 ? (
            <EmptyState>No rider files yet.</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {(files ?? []).map((f) => (
                <Card key={f.id}>
                  <CardContent className="flex items-center gap-2 p-3 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{f.type} rider</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {f.uploaded_by}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="post">
          <PostShowNotes showId={show.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
