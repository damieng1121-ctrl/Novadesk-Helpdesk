import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Novadesk Helpdesk",
  description: "Multi-tenant IT helpdesk, knowledge base, and DfE digital standards compliance for UK primary schools.",
};

// Runs before paint so the page never flashes the wrong theme. Reads the
// same localStorage key ThemeToggle writes; "system" (or no stored
// preference yet) falls back to the OS/browser setting.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("novadesk-theme");
    var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The inline theme script below sets the `dark` class before
      // hydration, which never matches the server-rendered markup — this is
      // the standard, known-safe mismatch every class-based dark mode
      // implementation has (same as the next-themes library).
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
