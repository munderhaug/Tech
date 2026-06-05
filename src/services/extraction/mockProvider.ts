// MockLlmProvider — heuristic, offline, no network.
//
// Stands in for a real server-side LLM call so the whole pipeline (upload → extract →
// editable confidence-scored items → gap matching) is demoable without a provider
// decision or API key. Swap for a real provider via the LLM_PROVIDER config; the
// interface (LlmProvider) does not change.

import type { NormalizedSpec, RequirementCategory } from "@/domain/types";
import type { ExtractionResult, LlmProvider, RequirementDraft } from "./types";

const LOW_CONFIDENCE = 0.6;

/** Keyword → category heuristics. First match wins; falls through to OTHER. */
const CATEGORY_HINTS: Array<[RegExp, RequirementCategory]> = [
  [/\b(foh|front of house|main\s*console|l-acoustics|d&b|pa system|line array)\b/i, "SOUND_FOH"],
  [/\b(monitor|wedge|iem|in-ear|sidefill|mon\s*desk|monitor console)\b/i, "SOUND_MON"],
  [/\b(input|channel|di\b|mic|microphone|sm58|sm57|patch|stagebox|snake)\b/i, "SOUND_INPUTS"],
  [/\b(light|lighting|par|moving head|wash|spot|fixture|dimmer|hazer|fog)\b/i, "LIGHTING"],
  [/\b(av|video|projector|led wall|screen|hdmi|sdi|camera|playback|timecode)\b/i, "AV"],
  [/\b(backline|drum|guitar|bass amp|keyboard|piano|amp\b|cabinet|riser kit)\b/i, "BACKLINE"],
  [/\b(riser|stage|deck|drum riser|truss|barricade|tent|staging)\b/i, "STAGING"],
  [/\b(power|distro|amps?\b|three.?phase|32a|63a|16a|generator|mains)\b/i, "POWER"],
  [/\b(crew|stagehand|loader|runner|call time|techs?\b|hands)\b/i, "CREW_CALL"],
];

function categorize(line: string): { category: RequirementCategory; confidence: number } {
  for (const [re, category] of CATEGORY_HINTS) {
    if (re.test(line)) return { category, confidence: 0.82 };
  }
  return { category: "OTHER", confidence: 0.45 };
}

/** Pull qty / make / model out of a line, best-effort. */
function normalizeLine(line: string): { spec: NormalizedSpec; confidence: number } {
  const spec: NormalizedSpec = {};
  let confidence = 0.5;

  const qtyMatch = line.match(/(?:^|\b)(\d{1,3})\s*(?:x|×|\*|pcs?|pieces?|units?)?\s+/i);
  if (qtyMatch) {
    spec.qty = parseInt(qtyMatch[1], 10);
    confidence += 0.15;
  }

  // Common make tokens; cheap but illustrative.
  const makeMatch = line.match(
    /\b(DiGiCo|Yamaha|Midas|Avid|Allen\s*&\s*Heath|Shure|Sennheiser|L-?Acoustics|d&b|Martin|Robe|Clay\s*Paky|Chamsys|MA|Meyer)\b/i,
  );
  if (makeMatch) {
    spec.make = makeMatch[1];
    confidence += 0.15;
  }

  // Model-ish token: letters+digits like SD12, CL5, SM58, M32, K2.
  const modelMatch = line.match(/\b([A-Z]{1,4}-?\d{1,4}[A-Z]?)\b/);
  if (modelMatch) {
    spec.model = modelMatch[1];
    confidence += 0.15;
  }

  return { spec, confidence: Math.min(confidence, 0.95) };
}

/** Split rider text into candidate requirement lines (bullets / numbered / newlines). */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length >= 3 && /[a-z]/i.test(l))
    // Drop obvious headers/section titles (all caps, short, no qty).
    .filter((l) => !(l === l.toUpperCase() && l.length < 24 && !/\d/.test(l)));
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";

  async extract(riderText: string): Promise<ExtractionResult> {
    const lines = splitLines(riderText);
    const drafts: RequirementDraft[] = lines.map((line, idx) => {
      const cat = categorize(line);
      const norm = normalizeLine(line);
      // Blend category + normalization confidence.
      const confidence = Math.round(((cat.confidence + norm.confidence) / 2) * 100) / 100;
      return {
        category: cat.category,
        description: line,
        normalized: norm.spec,
        confidence,
        source_ref: `line ${idx + 1}`,
      };
    });

    return {
      drafts,
      provider: this.name,
      lowConfidenceThreshold: LOW_CONFIDENCE,
    };
  }
}
