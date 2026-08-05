import Link from "next/link";
import { prisma } from "@/lib/db";
import { AnnouncementsBanner } from "@/components/announcements-banner";

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

export async function PortalHome({ tenantId }: { tenantId: string }) {
  const [settingsRow, popularArticles] = await Promise.all([
    prisma.portalSettings.findUnique({ where: { tenantId } }),
    prisma.kbArticle.findMany({
      where: { tenantId, status: "PUBLISHED", isDeleted: false },
      orderBy: { viewCount: "desc" },
      take: 5,
    }),
  ]);

  const settings = settingsRow
    ? { ...DEFAULTS, ...settingsRow, usefulLinks: settingsRow.usefulLinks as typeof DEFAULTS.usefulLinks }
    : DEFAULTS;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-center text-white">
        <h1 className="text-2xl font-semibold sm:text-3xl">{settings.heroTitle}</h1>
        <p className="mt-2 text-blue-100">{settings.heroSubtitle}</p>
        {settings.heroShowSearch && (
          <form action="/portal/kb" className="mx-auto mt-5 max-w-md">
            <input
              name="q"
              placeholder="Search for help…"
              className="w-full rounded-md border-0 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </form>
        )}
      </div>

      {settings.showQuickActions && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/portal/tickets/new"
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
          >
            <p className="font-semibold text-slate-900">Raise a ticket</p>
            <p className="mt-1 text-sm text-slate-500">Report a problem or request something</p>
          </Link>
          <Link href="/portal/tickets" className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300">
            <p className="font-semibold text-slate-900">My tickets</p>
            <p className="mt-1 text-sm text-slate-500">Check the status of what you&apos;ve raised</p>
          </Link>
        </div>
      )}

      {settings.showAnnouncements && (
        <div className="mt-6">
          <AnnouncementsBanner tenantId={tenantId} audience="REQUESTERS" />
        </div>
      )}

      {settings.showPopularArticles && popularArticles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Popular articles</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {popularArticles.map((a) => (
              <Link key={a.id} href={`/portal/kb/${a.slug}`} className="block p-4 hover:bg-slate-50">
                <p className="font-medium text-slate-900">{a.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {settings.showUrgentHelp && settings.urgentHelpEnabled && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="font-semibold text-red-900">{settings.urgentHelpTitle}</p>
            <p className="mt-1 text-sm text-red-800">{settings.urgentHelpDescription}</p>
            <div className="mt-3 space-y-1 text-sm text-red-900">
              {settings.urgentHelpHotline && <p>Phone: {settings.urgentHelpHotline}</p>}
              {settings.urgentHelpEmail && <p>Email: {settings.urgentHelpEmail}</p>}
              <p className="text-red-700">{settings.urgentHelpAvailability}</p>
            </div>
          </div>
        )}

        {settings.showUsefulLinks && settings.usefulLinks.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="font-semibold text-slate-900">Useful links</p>
            <ul className="mt-3 space-y-2 text-sm">
              {settings.usefulLinks.map((link) => (
                <li key={link.id}>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
