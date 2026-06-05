// Rider extraction contract.
//
// The model PROVIDER must be swappable (HANDOVER + PRD §5.1). Nothing downstream may
// depend on a concrete vendor. A provider takes raw rider text and returns confidence-
// scored, categorized DRAFT line items. AI output is a draft, never authoritative —
// the user edits/splits/merges/deletes before it is matched.

import type { NormalizedSpec, RequirementCategory } from "@/domain/types";

export interface RequirementDraft {
  category: RequirementCategory;
  description: string;
  normalized: NormalizedSpec;
  confidence: number; // 0..1
  source_ref: string | null;
}

export interface ExtractionResult {
  drafts: RequirementDraft[];
  provider: string;
  /** Items below this score should be flagged for human verification before matching. */
  lowConfidenceThreshold: number;
}

export interface LlmProvider {
  readonly name: string;
  extract(riderText: string): Promise<ExtractionResult>;
}
