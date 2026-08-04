import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import type { AiCompletionProvider, KbSuggestInput, KbSuggestResult, SummarizeInput, TriageInput, TriageResult } from "./types";
import { DisabledAiProvider } from "./disabled";
import { ClaudeAiProvider } from "./claude";
import { GeminiAiProvider } from "./gemini";

export type { AiCompletionProvider } from "./types";

/** Wraps any provider so a flaky AI call never breaks the ticketing/KB flow it's assisting. */
class SafeAiProvider implements AiCompletionProvider {
  constructor(private inner: AiCompletionProvider) {}
  get name() {
    return this.inner.name;
  }
  async triageTicket(input: TriageInput): Promise<TriageResult> {
    try {
      return await this.inner.triageTicket(input);
    } catch (err) {
      console.error(`[ai:${this.inner.name}] triageTicket failed`, err);
      return { suggestedCategory: null, suggestedPriority: null, summary: "" };
    }
  }
  async suggestKbArticles(input: KbSuggestInput): Promise<KbSuggestResult> {
    try {
      return await this.inner.suggestKbArticles(input);
    } catch (err) {
      console.error(`[ai:${this.inner.name}] suggestKbArticles failed`, err);
      return { articleIds: [] };
    }
  }
  async summarizeThread(input: SummarizeInput): Promise<string> {
    try {
      return await this.inner.summarizeThread(input);
    } catch (err) {
      console.error(`[ai:${this.inner.name}] summarizeThread failed`, err);
      return "";
    }
  }
}

/**
 * Resolve the AI provider to use for a given tenant. Each tenant can opt
 * into Claude or Gemini (or neither) and optionally supply their own API
 * key; otherwise the platform-level key from env is used as a fallback so
 * the feature works out of the box in this scaffold/demo.
 */
export async function getAiProviderForTenant(tenantId: string | null): Promise<AiCompletionProvider> {
  const config = tenantId ? await prisma.aiProviderConfig.findUnique({ where: { tenantId } }) : null;

  const provider = config?.provider ?? (process.env.DEFAULT_AI_PROVIDER as "CLAUDE" | "GEMINI" | "DISABLED" | undefined) ?? "DISABLED";

  if (provider === "CLAUDE") {
    const apiKey = config?.apiKeyCiphertext ? decrypt(config.apiKeyCiphertext) : process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new DisabledAiProvider();
    const model = config?.model ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
    return new SafeAiProvider(new ClaudeAiProvider(apiKey, model));
  }

  if (provider === "GEMINI") {
    const apiKey = config?.apiKeyCiphertext ? decrypt(config.apiKeyCiphertext) : process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) return new DisabledAiProvider();
    const model = config?.model ?? process.env.GOOGLE_GENAI_MODEL ?? "gemini-2.5-flash";
    return new SafeAiProvider(new GeminiAiProvider(apiKey, model));
  }

  return new DisabledAiProvider();
}
