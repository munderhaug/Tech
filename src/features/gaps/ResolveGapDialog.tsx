import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, Label, Select, Textarea } from "@/components/ui/primitives";
import { useApp } from "@/app/AppContext";
import { resolveGap } from "./useGaps";
import { GapResolutionError } from "@/domain/gapEngine";
import { RESOLUTION_TYPES, type RequirementItem, type ResolutionType } from "@/domain/types";

const RESOLUTION_LABELS: Record<ResolutionType, string> = {
  SUBSTITUTED: "Substituted",
  WONT_PROVIDE: "Won't provide",
  PENDING: "Pending",
  CROSS_RENTAL_ORDERED: "Cross-rental ordered",
  CLARIFICATION_NEEDED: "Clarification needed",
};

const NOTE_HINT: Record<ResolutionType, string> = {
  SUBSTITUTED: "What did you substitute, and why is it acceptable?",
  WONT_PROVIDE: "Has the artist been notified / accepted?",
  PENDING: "What are we waiting on, and the ETA?",
  CROSS_RENTAL_ORDERED: "Vendor and ETA?",
  CLARIFICATION_NEEDED: "Question for the artist TM (internal tracking — not sent to artist).",
};

export function ResolveGapDialog({
  requirement,
  trigger,
}: {
  requirement: RequirementItem;
  trigger: React.ReactNode;
}) {
  const { user } = useApp();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<ResolutionType>("SUBSTITUTED");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await resolveGap({ requirementItemId: requirement.id, resolutionType: type, note }, user);
      setNote("");
      setOpen(false);
    } catch (e) {
      // The gap engine enforces "no silent clearing" — surface its message.
      setError(e instanceof GapResolutionError ? e.message : "Could not save resolution.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve gap</DialogTitle>
          <DialogDescription className="line-clamp-2">{requirement.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rtype">Resolution type</Label>
            <Select
              id="rtype"
              value={type}
              onChange={(e) => setType(e.target.value as ResolutionType)}
            >
              {RESOLUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESOLUTION_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Reason (required)</Label>
            <Textarea
              id="note"
              value={note}
              placeholder={NOTE_HINT[type]}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A gap can never be cleared silently — a reason is mandatory and recorded against your name.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={note.trim().length === 0}>
              Record resolution
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
