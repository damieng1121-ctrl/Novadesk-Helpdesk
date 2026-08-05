import { z } from "zod";
import { requireTenantSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

const DEFAULTS = {
  heroTitle: "Hello, how can we help?",
  heroSubtitle: "Search our knowledge base or submit a ticket.",
  heroShowSearch: true,
  showAnnouncements: true,
  showQuickActions: true,
  showPopularArticles: true,
  showUrgentHelp: true,
  showUsefulLinks: true,
  usefulLinks: [] as { id: string; title: string; url: string }[],
  urgentHelpEnabled: true,
  urgentHelpTitle: "Need urgent help?",
  urgentHelpDescription: "For critical issues stopping teaching right now, please call us immediately.",
  urgentHelpHotline: "",
  urgentHelpEmail: "",
  urgentHelpAvailability: "Available during school office hours",
};

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    const settings = await prisma.portalSettings.findUnique({ where: { tenantId: session.user.tenantId } });
    if (!settings) return DEFAULTS;
    return { ...settings, usefulLinks: settings.usefulLinks as typeof DEFAULTS.usefulLinks };
  });
}

const linkSchema = z.object({ id: z.string(), title: z.string().min(1).max(80), url: z.string().url() });

const bodySchema = z.object({
  heroTitle: z.string().min(1).max(150),
  heroSubtitle: z.string().max(300),
  heroShowSearch: z.boolean(),
  showAnnouncements: z.boolean(),
  showQuickActions: z.boolean(),
  showPopularArticles: z.boolean(),
  showUrgentHelp: z.boolean(),
  showUsefulLinks: z.boolean(),
  usefulLinks: z.array(linkSchema).max(20),
  urgentHelpEnabled: z.boolean(),
  urgentHelpTitle: z.string().max(150),
  urgentHelpDescription: z.string().max(500),
  urgentHelpHotline: z.string().max(40),
  urgentHelpEmail: z.string().max(150),
  urgentHelpAvailability: z.string().max(150),
});

export async function PUT(req: Request) {
  return withApiErrors(async () => {
    const session = await requireTenantSession();
    if (!isAdmin(session.user.role)) throw new AuthError("Only admins can edit the self-service portal", 403);
    const body = bodySchema.parse(await req.json());

    return prisma.portalSettings.upsert({
      where: { tenantId: session.user.tenantId },
      create: { tenantId: session.user.tenantId, ...body },
      update: body,
    });
  });
}
