import type { TicketPriority } from "@prisma/client";

export interface TriageInput {
  subject: string;
  description: string;
  categoryNames: string[];
}

export interface TriageResult {
  suggestedCategory: string | null;
  suggestedPriority: TicketPriority | null;
  summary: string;
  /** 0-100 estimate of requester frustration (100 = extremely frustrated). Null if the model didn't return a usable value. */
  sentimentScore: number | null;
  /** A preliminary troubleshooting suggestion for the agent picking this up. */
  suggestedSolution: string | null;
}

export interface KbSuggestInput {
  subject: string;
  description: string;
  articles: { id: string; title: string; excerpt: string }[];
}

export interface KbSuggestResult {
  /** Article ids ranked most to least relevant, capped to a handful. */
  articleIds: string[];
}

export interface SummarizeInput {
  /** Chronological ticket comments, oldest first. */
  messages: { author: string; body: string }[];
}

export interface AiCompletionProvider {
  readonly name: "claude" | "gemini" | "disabled";
  triageTicket(input: TriageInput): Promise<TriageResult>;
  suggestKbArticles(input: KbSuggestInput): Promise<KbSuggestResult>;
  summarizeThread(input: SummarizeInput): Promise<string>;
}
