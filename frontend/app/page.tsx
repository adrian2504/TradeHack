"use client";

import { AUCTIONS } from "@/lib/auctions";
import AuctionGrid from "@/components/AuctionGrid";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const isAdmin = user?.role === "admin";

  // redirect to /login if not logged in
  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login");
    }
  }, [isReady, user, router]);

  // while loading auth or redirecting, show simple message
  if (!isReady || !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-slate-300">
        Redirecting to login…
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Choose an Auction Theme
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Each arena combines donation size with philanthropic profile and
          fairness metrics. Pick one and let the AI agents start negotiating.
        </p>
      </div>

      <AuctionGrid
        auctions={AUCTIONS}
        onSelect={(auction) => router.push(`/auctions/${auction.slug}`)}
        showScoringMix={isAdmin}
      />
    </section>
  );
}
