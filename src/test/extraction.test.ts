import { describe, expect, it } from "vitest";
import { MockLlmProvider } from "@/services/extraction/mockProvider";

describe("MockLlmProvider", () => {
  const provider = new MockLlmProvider();

  it("extracts confidence-scored, categorized drafts from rider text", async () => {
    const text = `FOH
- 1x DiGiCo SD12 at front of house
- 12x Shure SM58 vocal mics
- 8x moving head wash fixtures`;
    const result = await provider.extract(text);

    expect(result.provider).toBe("mock");
    expect(result.drafts.length).toBe(3); // "FOH" header dropped
    const sd12 = result.drafts.find((d) => d.description.includes("SD12"));
    expect(sd12?.category).toBe("SOUND_FOH");
    expect(sd12?.normalized.qty).toBe(1);
    expect(sd12?.normalized.model).toBe("SD12");

    const sm58 = result.drafts.find((d) => d.description.includes("SM58"));
    expect(sm58?.category).toBe("SOUND_INPUTS");
    expect(sm58?.normalized.qty).toBe(12);

    const light = result.drafts.find((d) => d.description.includes("moving head"));
    expect(light?.category).toBe("LIGHTING");
  });

  it("assigns every draft a confidence in [0,1] and a source_ref", async () => {
    const result = await provider.extract("4x DI boxes for keys");
    for (const d of result.drafts) {
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
      expect(d.source_ref).toMatch(/line/);
    }
  });
});
