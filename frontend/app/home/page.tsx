"use client";

import { AUCTIONS } from "@/lib/auctions";
import AuctionGrid from "@/components/AuctionGrid";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

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
