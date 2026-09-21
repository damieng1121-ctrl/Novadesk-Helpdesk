import { prisma } from "@/lib/db";
import { runSlaBreachAlerts, runAutoCloseInactiveResolved } from "@/lib/triggers";

/**
 * Scheduled maintenance — point Cloud Scheduler (or any cron caller) at
 * this URL with ?token=<CRON_SECRET>. Runs SLA breach alerts and the
 * auto-close-inactive-resolved trigger; both are safe to run as often as
 * you like (each ticket only ever gets one breach email, and auto-close
 * only touches tickets past the inactivity window).
 */
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [slaBreachesAlerted, autoClosedCount] = await Promise.all([
    runSlaBreachAlerts(prisma),
    runAutoCloseInactiveResolved(prisma),
  ]);

  return Response.json({ ok: true, slaBreachesAlerted, autoClosedCount });
}

// Cloud Scheduler's HTTP target defaults to whatever method you configure,
// but GET is convenient for a manual/browser check — same auth, same effect.
export const GET = POST;
