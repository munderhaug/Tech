import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Trash2 } from "lucide-react";
import { getStore } from "@/data/store";
import { useApp } from "@/app/AppContext";
import { getLlmProvider, type RequirementDraft } from "@/services/extraction";
import {
  REQUIREMENT_CATEGORIES,
  type RequirementCategory,
  type RequirementItem,
  type RiderFile,
} from "@/domain/types";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { ConfidenceBadge } from "@/components/StatusBadge";
import { newId, nowIso } from "@/lib/utils";

export function RiderIntakePage() {
  const { showId } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const show = useLiveQuery(
    () => (showId ? getStore().artistShows.get(showId) : Promise.resolve(undefined)),
    [showId],
  );

  const [text, setText] = React.useState("");
  const [drafts, setDrafts] = React.useState<RequirementDraft[] | null>(null);
  const [provider, setProvider] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const extract = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const result = await getLlmProvider().extract(text);
    setDrafts(result.drafts);
    setProvider(result.provider);
    setBusy(false);
  };

  const updateDraft = (idx: number, patch: Partial<RequirementDraft>) => {
    setDrafts((d) => d?.map((item, i) => (i === idx ? { ...item, ...patch } : item)) ?? null);
  };
  const removeDraft = (idx: number) => {
    setDrafts((d) => d?.filter((_, i) => i !== idx) ?? null);
  };
  const addBlank = () => {
    setDrafts((d) => [
      ...(d ?? []),
      { category: "OTHER", description: "", normalized: {}, confidence: 0.5, source_ref: "manual" },
    ]);
  };

  const save = async () => {
    if (!show || !drafts) return;
    const store = getStore();
    const riderFile: RiderFile = {
      id: newId(),
      artist_show_id: show.id,
      storage_path: null,
      type: "TEXT",
      raw_text: text,
      uploaded_by: user.name,
      uploaded_at: nowIso(),
      client_uuid: newId(),
    };
    const items: RequirementItem[] = drafts
      .filter((d) => d.description.trim())
      .map((d) => ({
        id: newId(),
        artist_show_id: show.id,
        rider_file_id: riderFile.id,
        category: d.category,
        description: d.description.trim(),
        normalized: d.normalized,
        confidence: d.confidence,
        source_ref: d.source_ref,
        status: "UNMATCHED", // recomputed live by the gap engine
        matched_inventory_id: null,
        created_by_ai: d.source_ref !== "manual",
        client_uuid: newId(),
        created_at: nowIso(),
        updated_at: nowIso(),
      }));
    await store.riderFiles.put(riderFile);
    await store.requirementItems.bulkPut(items);
    navigate(`/artists/${show.id}/gaps`);
  };

  if (!show) return <EmptyState>Loading…</EmptyState>;

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/artists/${show.id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {show.artist_name}
      </Link>
      <h1 className="text-xl font-bold">Rider intake</h1>

      <Card>
        <CardContent className="p-3">
          <Label>Paste rider text or email</Label>
          <p className="mb-2 text-xs text-muted-foreground">
            PDF/Word/scan upload with OCR runs server-side once a provider is wired. For now, paste
            the rider text and the extraction pipeline produces draft line items.
          </p>
          <Textarea
            className="min-h-[160px] font-mono text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"FOH\n- 1x DiGiCo SD12\n- 12x Shure SM58\n..."}
          />
          <Button className="mt-2" onClick={extract} disabled={!text.trim() || busy}>
            <Sparkles className="h-4 w-4" /> {busy ? "Extracting…" : "Extract line items"}
          </Button>
        </CardContent>
      </Card>

      {drafts && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {drafts.length} draft item(s){" "}
              <span className="font-normal text-muted-foreground">via {provider} · editable</span>
            </h2>
            <Button size="sm" variant="outline" onClick={addBlank}>
              Add item
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            AI output is a draft, never authoritative — edit category, text, and quantity before saving.
          </p>

          {drafts.map((d, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-2">
                  <Select
                    className="h-8 w-auto text-xs"
                    value={d.category}
                    onChange={(e) =>
                      updateDraft(i, { category: e.target.value as RequirementCategory })
                    }
                  >
                    {REQUIREMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                  <ConfidenceBadge value={d.confidence} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-8 w-8"
                    onClick={() => removeDraft(i)}
                    aria-label="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={d.description}
                  onChange={(e) => updateDraft(i, { description: e.target.value })}
                  placeholder="Requirement description"
                />
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={d.normalized.qty ?? ""}
                    onChange={(e) =>
                      updateDraft(i, {
                        normalized: { ...d.normalized, qty: Number(e.target.value) || undefined },
                      })
                    }
                  />
                  {d.source_ref && (
                    <span className="text-[11px] text-muted-foreground">{d.source_ref}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {drafts.length > 0 && (
            <Button onClick={save}>Save {drafts.filter((d) => d.description.trim()).length} requirements</Button>
          )}
        </div>
      )}
    </div>
  );
}
