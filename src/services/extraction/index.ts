// Provider selection — config-driven, NEVER hardcoded to one vendor.
//
// Set VITE_LLM_PROVIDER to choose. In this build only "mock" is wired (no live calls,
// no key). To add a real provider:
//   1. Implement LlmProvider in e.g. ./openaiCompatibleProvider.ts. The server-side call
//      should hit a swappable base URL (cloud API OR self-hosted OpenAI-compatible endpoint
//      — see Martin's data-sovereignty preference) and request JSON-schema structured output.
//   2. Register it in the switch below keyed by its VITE_LLM_PROVIDER value.
//   3. Extraction stays server-side; the browser never holds the model key.
//
// Nothing downstream changes — callers depend only on LlmProvider.

import { MockLlmProvider } from "./mockProvider";
import type { LlmProvider } from "./types";

export type { ExtractionResult, LlmProvider, RequirementDraft } from "./types";

const PROVIDER = (import.meta.env?.VITE_LLM_PROVIDER as string | undefined) ?? "mock";

let instance: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (instance) return instance;
  switch (PROVIDER) {
    case "mock":
      instance = new MockLlmProvider();
      break;
    // case "openai-compatible":
    //   instance = new OpenAiCompatibleProvider({ baseUrl: import.meta.env.VITE_LLM_BASE_URL });
    //   break;
    default:
      // Unknown provider configured — fail safe to the mock rather than a hard vendor lock.
      console.warn(`Unknown LLM_PROVIDER "${PROVIDER}", falling back to mock.`);
      instance = new MockLlmProvider();
  }
  return instance;
}
