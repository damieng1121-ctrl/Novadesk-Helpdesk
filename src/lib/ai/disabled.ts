import type { AiCompletionProvider, KbSuggestResult, TriageResult } from "./types";

/** No-op provider used when a tenant hasn't configured AI, or no API key is available. */
export class DisabledAiProvider implements AiCompletionProvider {
  readonly name = "disabled" as const;

  async triageTicket(): Promise<TriageResult> {
    return { suggestedCategory: null, suggestedPriority: null, summary: "" };
  }

  async suggestKbArticles(): Promise<KbSuggestResult> {
    return { articleIds: [] };
  }

  async summarizeThread(): Promise<string> {
    return "";
  }
}
