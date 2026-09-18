import Link from "next/link";
import { Ticket, BookOpen, ShieldCheck, Sparkles, ClipboardCheck, Users } from "lucide-react";

const features = [
  {
    icon: Ticket,
    title: "Ticketing built for school IT",
    body: "Staff raise tickets in seconds; your team triages, assigns, and resolves with SLAs that make sense for a term-time school day.",
  },
  {
    icon: BookOpen,
    title: "Knowledge base",
    body: "Publish how-tos for interactive whiteboards, MIS logins, and printers so common issues get self-served instead of queued.",
  },
  {
    icon: ShieldCheck,
    title: "Google SSO + 2FA",
    body: "Users sign in with their existing Google account, secured by Google Identity Platform and an enforced second factor — access is invite-only, so no domain has to match.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted triage",
    body: "New tickets are auto-categorised and summarised, and the knowledge base suggests matching articles before a human ever picks it up.",
  },
  {
    icon: ClipboardCheck,
    title: "DfE digital standards checklist",
    body: "Track readiness against the DfE's digital and technology standards — cyber security, filtering, connectivity, and more — in one place.",
  },
  {
    icon: Users,
    title: "One shared desk, organised by client",
    body: "Your technicians work every ticket from one queue; tag each user with the school or organisation they belong to for filtering and reporting.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="border-b border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">N</span>
            Novadesk Helpdesk
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-white/70 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-slate-950 px-6 py-24 text-center">
          <div
            className="absolute inset-0 opacity-40"
            style={{ background: "radial-gradient(circle at 50% 0%, rgba(99,102,241,0.35), transparent 60%)" }}
            aria-hidden
          />
          <div className="relative">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-400">
              Built for UK primary schools
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
              One IT helpdesk for every school you support
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/70">
              Ticketing, a knowledge base, Google SSO with 2FA, AI-assisted triage, and a live DfE digital
              standards compliance checklist — one shared helpdesk for your technicians, invite-only for
              everyone else.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
              >
                Sign in with Google
              </Link>
              <a
                href="#features"
                className="rounded-md border border-white/20 px-6 py-3 font-medium text-white hover:bg-white/10"
              >
                See what&apos;s included
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="bg-slate-50 py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <f.icon size={20} />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-600">
        Novadesk Helpdesk — one IT helpdesk for teams supporting multiple schools.
      </footer>
    </div>
  );
}
