import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can view AI settings", 403);
    const config = await prisma.aiProviderConfig.findUnique({ where: { tenantId: session.user.tenantId } });
    return {
      provider: config?.provider ?? "DISABLED",
      model: config?.model ?? null,
      hasOwnApiKey: !!config?.apiKeyCiphertext,
      ticketTriageEnabled: config?.ticketTriageEnabled ?? true,
      kbSuggestionsEnabled: config?.kbSuggestionsEnabled ?? true,
    };
  });
}

const bodySchema = z.object({
  provider: z.enum(["CLAUDE", "GEMINI", "DISABLED"]),
  model: z.string().max(100).optional(),
  apiKey: z.string().optional(), // if omitted, falls back to the platform's own key from env
  ticketTriageEnabled: z.boolean().optional(),
  kbSuggestionsEnabled: z.boolean().optional(),
});

export async function PUT(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can change AI settings", 403);
    const body = bodySchema.parse(await req.json());

    const config = await prisma.aiProviderConfig.upsert({
      where: { tenantId: session.user.tenantId },
      create: {
        tenantId: session.user.tenantId,
        provider: body.provider,
        model: body.model,
        apiKeyCiphertext: body.apiKey ? encrypt(body.apiKey) : undefined,
        ticketTriageEnabled: body.ticketTriageEnabled ?? true,
        kbSuggestionsEnabled: body.kbSuggestionsEnabled ?? true,
      },
      update: {
        provider: body.provider,
        model: body.model,
        ...(body.apiKey ? { apiKeyCiphertext: encrypt(body.apiKey) } : {}),
        ...(body.ticketTriageEnabled !== undefined ? { ticketTriageEnabled: body.ticketTriageEnabled } : {}),
        ...(body.kbSuggestionsEnabled !== undefined ? { kbSuggestionsEnabled: body.kbSuggestionsEnabled } : {}),
      },
    });

    return { provider: config.provider, model: config.model, hasOwnApiKey: !!config.apiKeyCiphertext };
  });
}
