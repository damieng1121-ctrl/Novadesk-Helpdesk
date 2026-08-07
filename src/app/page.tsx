import Link from "next/link";

const features = [
  {
    title: "Ticketing built for school IT",
    body: "Staff raise tickets in seconds; your team triages, assigns, and resolves with SLAs that make sense for a term-time school day.",
  },
  {
    title: "Knowledge base",
    body: "Publish how-tos for interactive whiteboards, MIS logins, and printers so common issues get self-served instead of queued.",
  },
  {
    title: "Google SSO + 2FA",
    body: "Staff sign in with their existing Google Workspace for Education account, secured by Google Identity Platform and an enforced second factor.",
  },
  {
    title: "AI-assisted triage",
    body: "New tickets are auto-categorised and summarised, and the knowledge base suggests matching articles before a human ever picks it up.",
  },
  {
    title: "DfE digital standards checklist",
    body: "Track your school's readiness against the DfE's digital and technology standards — cyber security, filtering, connectivity, and more — in one place.",
  },
  {
    title: "Multi-tenant by design",
    body: "Every school (or trust) is fully isolated: its own users, tickets, articles, and compliance record, on one shared platform.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">N</span>
            Novadesk Helpdesk
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
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
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Built for UK primary schools
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            One IT helpdesk for every school in your trust
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Ticketing, a knowledge base, Google SSO with 2FA, AI-assisted triage, and a live DfE digital
            standards compliance checklist — a fully multi-tenant portal purpose-built for primary schools.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
            >
              Sign in with Google
            </Link>
            <a
              href="#features"
              className="rounded-md border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-100"
            >
              See what&apos;s included
            </a>
          </div>
        </section>

        <section id="features" className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-700">
        Novadesk Helpdesk — a multi-tenant helpdesk platform for UK primary schools.
      </footer>
    </div>
  );
}
