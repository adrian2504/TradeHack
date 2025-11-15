import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentBazaar – Fairness-Aware AI Auctions",
  description:
    "A multi-agent auction lab where AI bidders compete on both dollars and impact.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg font-bold text-emerald-300">
                AB
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  AgentBazaar
                </h1>
                <p className="text-xs text-slate-400">
                  AI auction lab for high-impact, fairness-aware bidding.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
              Hackathon Edition
            </span>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
            Powered by Gemini, OpenRouter, Solana, Snowflake, Aristotle, Vultr,
            ElevenLabs &amp; .tech
          </footer>
        </div>
      </body>
    </html>
  );
}
