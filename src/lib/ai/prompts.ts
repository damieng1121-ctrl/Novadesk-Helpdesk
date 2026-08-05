import type { TicketPriority } from "@prisma/client";
import type { KbSuggestInput, SummarizeInput, TriageInput, TriageResult } from "./types";

const VALID_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function triagePrompt({ subject, description, categoryNames }: TriageInput): string {
  return `You are the triage assistant for an IT helpdesk at a UK primary school.
A member of staff has raised the following ticket:

Subject: ${subject}
Description: ${description}

Available categories: ${categoryNames.length ? categoryNames.join(", ") : "(none configured)"}

Reply with ONLY a JSON object, no markdown fences, matching exactly:
{
  "suggestedCategory": string | null,   // one of the available categories, or null if none fit
  "suggestedPriority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": string, // one sentence, plain English, for a busy technician skimming a queue
  "sentimentScore": number, // 0-100 estimate of how frustrated the requester sounds (100 = extremely frustrated), based only on their wording
  "suggestedSolution": string // one or two preliminary troubleshooting steps for the agent to try first — empty string if nothing sensible comes to mind without more information
}
Guidance: CRITICAL is only for things stopping teaching from happening right now (e.g. whole-school network/internet down, safeguarding system inaccessible, exam access issue). Most day-to-day requests are MEDIUM or LOW.`;
}

export function kbSuggestPrompt({ subject, description, articles }: KbSuggestInput): string {
  const list = articles.map((a) => `- id: ${a.id}\n  title: ${a.title}\n  excerpt: ${a.excerpt}`).join("\n");
  return `A school IT helpdesk ticket was just raised:

Subject: ${subject}
Description: ${description}

Here are the school's published knowledge base articles:
${list || "(none)"}

Reply with ONLY a JSON object, no markdown fences:
{ "articleIds": string[] } // ids of the articles (from the list above) most likely to help, best match first, at most 3. Empty array if nothing is relevant.`;
}

export function summarizePrompt({ messages }: SummarizeInput): string {
  const thread = messages.map((m) => `${m.author}: ${m.body}`).join("\n---\n");
  return `Summarise this IT helpdesk ticket thread for a technician who hasn't read it yet.
Be concise (2-4 sentences), factual, and note the current state / what's still needed.

${thread}`;
}

/** Strip markdown code fences an LLM sometimes wraps JSON in, then JSON.parse. Returns null on failure. */
export function tryParseJson<T>(raw: string): T | null {
  const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

interface RawTriageResponse {
  suggestedCategory: string | null;
  suggestedPriority: string;
  summary: string;
  sentimentScore: number;
  suggestedSolution: string;
}

/** Shared validation/coercion of a triage response, used by every provider so each one only owns its own transport call. */
export function parseTriageResult(raw: string, categoryNames: string[]): TriageResult {
  const empty: TriageResult = {
    suggestedCategory: null,
    suggestedPriority: null,
    summary: "",
    sentimentScore: null,
    suggestedSolution: null,
  };
  const parsed = tryParseJson<RawTriageResponse>(raw);
  if (!parsed) return empty;

  const priority = VALID_PRIORITIES.includes(parsed.suggestedPriority as TicketPriority)
    ? (parsed.suggestedPriority as TicketPriority)
    : null;
  const sentimentScore =
    typeof parsed.sentimentScore === "number" && Number.isFinite(parsed.sentimentScore)
      ? Math.max(0, Math.min(100, Math.round(parsed.sentimentScore)))
      : null;

  return {
    suggestedCategory: categoryNames.includes(parsed.suggestedCategory ?? "") ? parsed.suggestedCategory : null,
    suggestedPriority: priority,
    summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
    sentimentScore,
    suggestedSolution:
      typeof parsed.suggestedSolution === "string" && parsed.suggestedSolution.trim()
        ? parsed.suggestedSolution.slice(0, 1000)
        : null,
  };
}
