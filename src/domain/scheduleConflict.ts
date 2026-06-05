// Stage schedule / day-sheet analysis (PRD §5.4, AC §9.5).
// Surfaces overlapping set times and impossible changeover flips.

import type { ArtistShow } from "./types";

export interface ScheduleIssue {
  kind: "OVERLAP" | "TIGHT_CHANGEOVER";
  showId: string;
  nextShowId: string;
  /** Minutes available for the flip (may be negative when sets overlap). */
  gapMin: number;
  /** Minutes the changeover requires. */
  requiredMin: number;
  message: string;
}

/** Shows with concrete set times, sorted chronologically. */
function timedSorted(shows: ArtistShow[]): ArtistShow[] {
  return shows
    .filter((s) => s.set_start && s.set_end)
    .sort((a, b) => Date.parse(a.set_start!) - Date.parse(b.set_start!));
}

/**
 * Analyse one stage's shows for a day. For each consecutive pair, the available flip
 * window is (nextStart − thisEnd); compare to this show's changeover_after_min.
 */
export function analyzeStageDay(shows: ArtistShow[]): ScheduleIssue[] {
  const sorted = timedSorted(shows);
  const issues: ScheduleIssue[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const gapMin = Math.round(
      (Date.parse(next.set_start!) - Date.parse(cur.set_end!)) / 60000,
    );
    const requiredMin = cur.changeover_after_min ?? 0;

    if (gapMin < 0) {
      issues.push({
        kind: "OVERLAP",
        showId: cur.id,
        nextShowId: next.id,
        gapMin,
        requiredMin,
        message: `${cur.artist_name} and ${next.artist_name} overlap by ${-gapMin} min.`,
      });
    } else if (requiredMin > 0 && gapMin < requiredMin) {
      issues.push({
        kind: "TIGHT_CHANGEOVER",
        showId: cur.id,
        nextShowId: next.id,
        gapMin,
        requiredMin,
        message: `Only ${gapMin} min to flip ${cur.artist_name} → ${next.artist_name}; ${requiredMin} min needed.`,
      });
    }
  }
  return issues;
}

/** The changeover window (minutes) between a show and the one after it, or null if last. */
export function changeoverWindowMin(shows: ArtistShow[], showId: string): number | null {
  const sorted = timedSorted(shows);
  const idx = sorted.findIndex((s) => s.id === showId);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  return Math.round(
    (Date.parse(sorted[idx + 1].set_start!) - Date.parse(sorted[idx].set_end!)) / 60000,
  );
}
