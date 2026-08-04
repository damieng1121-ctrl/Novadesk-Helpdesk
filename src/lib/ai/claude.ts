import Anthropic from "@anthropic-ai/sdk";
import type { TicketPriority } from "@prisma/client";
import type { AiCompletionProvider, KbSuggestInput, KbSuggestResult, SummarizeInput, TriageInput, TriageResult } from "./types";
import { kbSuggestPrompt, summarizePrompt, triagePrompt, tryParseJson } from "./prompts";

const VALID_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export class ClaudeAiProvider implements AiCompletionProvider {
  readonly name = "claude" as const;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = "claude-sonnet-4-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  private async complete(prompt: string): Promise<string> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b) => b.type === "text");
    return block?.type === "text" ? block.text : "";
  }

  async triageTicket(input: TriageInput): Promise<TriageResult> {
    const raw = await this.complete(triagePrompt(input));
    const parsed = tryParseJson<{ suggestedCategory: string | null; suggestedPriority: string; summary: string }>(raw);
    if (!parsed) return { suggestedCategory: null, suggestedPriority: null, summary: "" };
    const priority = VALID_PRIORITIES.includes(parsed.suggestedPriority as TicketPriority)
      ? (parsed.suggestedPriority as TicketPriority)
      : null;
    return {
      suggestedCategory: input.categoryNames.includes(parsed.suggestedCategory ?? "") ? parsed.suggestedCategory : null,
      suggestedPriority: priority,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    };
  }

  async suggestKbArticles(input: KbSuggestInput): Promise<KbSuggestResult> {
    const raw = await this.complete(kbSuggestPrompt(input));
    const parsed = tryParseJson<{ articleIds: string[] }>(raw);
    if (!parsed || !Array.isArray(parsed.articleIds)) return { articleIds: [] };
    const validIds = new Set(input.articles.map((a) => a.id));
    return { articleIds: parsed.articleIds.filter((id) => validIds.has(id)).slice(0, 3) };
  }

  async summarizeThread(input: SummarizeInput): Promise<string> {
    return (await this.complete(summarizePrompt(input))).slice(0, 1000);
  }
}
