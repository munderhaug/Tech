// Crew & time analysis (PRD §5.6, AC §9.7).
//
// Rest-period / working-time thresholds for Norway/EU are NOT yet confirmed by the human
// (HANDOVER open question). They live here as named, overridable constants — do NOT treat
// these as legally authoritative until Martin confirms. See docs/DECISIONS.md.

import type { Shift } from "./types";

export interface WorkingTimeRules {
  /** Max continuous shift length before a break is expected (minutes). */
  maxShiftBeforeBreakMin: number;
  /** Minimum rest between two shifts for the same person (minutes). */
  minRestBetweenShiftsMin: number;
}

/** PLACEHOLDER defaults — confirm against Norway/EU working-time rules before relying on them. */
export const DEFAULT_WORKING_TIME_RULES: WorkingTimeRules = {
  maxShiftBeforeBreakMin: 6 * 60, // 6h — placeholder
  minRestBetweenShiftsMin: 11 * 60, // 11h — common EU daily-rest figure, UNCONFIRMED
};

export interface CrewWarning {
  kind: "NO_BREAK" | "SHORT_REST" | "COVERAGE_GAP";
  crewMemberId?: string;
  stageId?: string;
  message: string;
}

const minutes = (from: string, to: string): number =>
  (Date.parse(to) - Date.parse(from)) / 60000;

function shiftLengthMin(s: Shift): number {
  return minutes(s.start_time, s.end_time);
}

function totalBreakMin(s: Shift): number {
  return s.breaks.reduce((sum, b) => sum + minutes(b.start, b.end), 0);
}

/**
 * Warn on shifts that exceed the break threshold with no logged break, and on
 * insufficient rest between a crew member's consecutive shifts.
 */
export function analyzeRestPeriods(
  shifts: Shift[],
  rules: WorkingTimeRules = DEFAULT_WORKING_TIME_RULES,
): CrewWarning[] {
  const warnings: CrewWarning[] = [];

  for (const s of shifts) {
    if (shiftLengthMin(s) > rules.maxShiftBeforeBreakMin && totalBreakMin(s) === 0) {
      warnings.push({
        kind: "NO_BREAK",
        crewMemberId: s.crew_member_id,
        stageId: s.stage_id,
        message: `Shift exceeds ${rules.maxShiftBeforeBreakMin / 60}h with no logged break.`,
      });
    }
  }

  const byMember = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = byMember.get(s.crew_member_id) ?? [];
    list.push(s);
    byMember.set(s.crew_member_id, list);
  }
  for (const [crewMemberId, list] of byMember) {
    const sorted = [...list].sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));
    for (let i = 0; i < sorted.length - 1; i++) {
      const rest = minutes(sorted[i].end_time, sorted[i + 1].start_time);
      if (rest >= 0 && rest < rules.minRestBetweenShiftsMin) {
        warnings.push({
          kind: "SHORT_REST",
          crewMemberId,
          message: `Only ${Math.round(rest / 60)}h rest before next shift; ${
            rules.minRestBetweenShiftsMin / 60
          }h expected.`,
        });
      }
    }
  }
  return warnings;
}

/**
 * Coverage-gap detection: within a required window for a stage, flag any sub-interval
 * not covered by at least `minCrew` shifts.
 */
export function findCoverageGaps(
  shifts: Shift[],
  stageId: string,
  windowStart: string,
  windowEnd: string,
  minCrew = 1,
): CrewWarning[] {
  const onStage = shifts.filter((s) => s.stage_id === stageId);
  // Build boundary points and check coverage of each sub-interval.
  const points = new Set<number>([Date.parse(windowStart), Date.parse(windowEnd)]);
  for (const s of onStage) {
    points.add(Date.parse(s.start_time));
    points.add(Date.parse(s.end_time));
  }
  const sorted = [...points].sort((a, b) => a - b).filter(
    (p) => p >= Date.parse(windowStart) && p <= Date.parse(windowEnd),
  );

  const warnings: CrewWarning[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const mid = (sorted[i] + sorted[i + 1]) / 2;
    const covering = onStage.filter(
      (s) => Date.parse(s.start_time) <= mid && Date.parse(s.end_time) > mid,
    ).length;
    if (covering < minCrew) {
      warnings.push({
        kind: "COVERAGE_GAP",
        stageId,
        message: `Coverage below ${minCrew} between ${new Date(sorted[i]).toISOString()} and ${new Date(
          sorted[i + 1],
        ).toISOString()}.`,
      });
    }
  }
  return warnings;
}
