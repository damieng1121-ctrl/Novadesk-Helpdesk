import type { KbSuggestInput, SummarizeInput, TriageInput } from "./types";

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
  "summary": string // one sentence, plain English, for a busy technician skimming a queue
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
