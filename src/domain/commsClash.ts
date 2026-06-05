// Walkie / comms channel map (PRD §5.9, AC §9.9).
// Detect RF channel clashes — the same channel assigned to more than one crew/department.

import type { CommsChannel } from "./types";

export interface CommsClash {
  rfChannel: string;
  assignments: CommsChannel[];
}

/** Group comms assignments by RF channel and return any channel used more than once. */
export function findCommsClashes(channels: CommsChannel[]): CommsClash[] {
  const byChannel = new Map<string, CommsChannel[]>();
  for (const c of channels) {
    const key = c.rf_channel.trim().toLowerCase();
    const list = byChannel.get(key) ?? [];
    list.push(c);
    byChannel.set(key, list);
  }
  const clashes: CommsClash[] = [];
  for (const list of byChannel.values()) {
    if (list.length > 1) {
      clashes.push({ rfChannel: list[0].rf_channel, assignments: list });
    }
  }
  return clashes;
}

/** Set of RF channels in clash — for UI highlighting. */
export function clashedChannels(channels: CommsChannel[]): Set<string> {
  return new Set(
    findCommsClashes(channels).flatMap((c) => c.assignments.map((a) => a.id)),
  );
}
