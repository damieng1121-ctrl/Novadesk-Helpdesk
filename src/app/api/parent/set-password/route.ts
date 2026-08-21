import { z } from "zod";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { consumeParentSetPasswordToken } from "@/lib/parent-invite";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
});

/** Public (no session) — the one-time token itself is the credential. */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const email = await consumeParentSetPasswordToken(body.token);
    if (!email) return NextResponse.json({ error: "This link has expired or was already used" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== "PARENT") {
      return NextResponse.json({ error: "This link has expired or was already used" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request", issues: err.issues }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
