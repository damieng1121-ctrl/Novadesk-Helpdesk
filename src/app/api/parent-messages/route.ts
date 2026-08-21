import { z } from "zod";
import { requireMisSession, AuthError } from "@/lib/session";
import { withApiErrors } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getNotificationProvider } from "@/lib/notifications";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    return prisma.parentMessage.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { sentAt: "desc" },
      include: { sender: { select: { name: true, email: true } }, _count: { select: { recipients: true } } },
    });
  });
}

const createSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  audience: z.enum(["ALL_PARENTS", "YEAR_GROUP", "FORM_GROUP", "INDIVIDUAL"]),
  audienceRef: z.string().min(1).optional().nullable(),
});

async function resolveGuardianIds(tenantId: string, audience: string, audienceRef: string | null | undefined): Promise<string[]> {
  if (audience === "ALL_PARENTS") {
    const guardians = await prisma.user.findMany({ where: { tenantId, role: "PARENT" }, select: { id: true } });
    return guardians.map((g) => g.id);
  }

  if (!audienceRef) throw new AuthError("audienceRef is required for this audience", 400);

  let pupilIds: string[];
  if (audience === "INDIVIDUAL") {
    pupilIds = [audienceRef];
  } else if (audience === "FORM_GROUP") {
    const pupils = await prisma.pupil.findMany({ where: { tenantId, formGroupId: audienceRef }, select: { id: true } });
    pupilIds = pupils.map((p) => p.id);
  } else {
    // YEAR_GROUP
    const pupils = await prisma.pupil.findMany({ where: { tenantId, yearGroup: audienceRef as never }, select: { id: true } });
    pupilIds = pupils.map((p) => p.id);
  }

  const links = await prisma.pupilGuardian.findMany({
    where: { tenantId, pupilId: { in: pupilIds } },
    select: { guardianId: true },
    distinct: ["guardianId"],
  });
  return links.map((l) => l.guardianId);
}

export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireMisSession();
    const body = createSchema.parse(await req.json());

    const guardianIds = await resolveGuardianIds(session.user.tenantId, body.audience, body.audienceRef);
    if (guardianIds.length === 0) throw new AuthError("No parents match this audience", 400);

    const message = await prisma.parentMessage.create({
      data: {
        tenantId: session.user.tenantId,
        senderId: session.user.id,
        subject: body.subject,
        body: body.body,
        audience: body.audience,
        audienceRef: body.audience === "ALL_PARENTS" ? null : body.audienceRef,
      },
    });

    await prisma.parentMessageRecipient.createMany({
      data: guardianIds.map((guardianId) => ({ tenantId: session.user.tenantId, messageId: message.id, guardianId })),
    });

    const guardians = await prisma.user.findMany({ where: { id: { in: guardianIds } }, select: { email: true } });
    const notifications = getNotificationProvider();
    await Promise.all(
      guardians.map((g) =>
        notifications.send({
          to: g.email,
          subject: `New message from school: ${body.subject}`,
          text: `${body.body}\n\nSign in to the parent portal to view and reply: ${process.env.NEXTAUTH_URL ?? ""}/parent/messages`,
          html: `<p>${body.body.replace(/\n/g, "<br/>")}</p><p><a href="${process.env.NEXTAUTH_URL ?? ""}/parent/messages">View in the parent portal</a></p>`,
        }),
      ),
    );

    return message;
  });
}
