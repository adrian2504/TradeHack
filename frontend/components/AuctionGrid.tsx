"use client";

import { AuctionTheme } from "@/types";
import AuctionCard from "./AuctionCard";

type Props = {
  auctions: AuctionTheme[];
  onSelect: (auction: AuctionTheme) => void;
  showScoringMix?: boolean;
};

export default function AuctionGrid({
  auctions,
  onSelect,
  showScoringMix = true,
}: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {auctions.map((auction) => (
        <button
          key={auction.id}
          onClick={() => onSelect(auction)}
          className="text-left"
        >
          <AuctionCard auction={auction} showScoringMix={showScoringMix} />
        </button>
      ))}
    </div>
  );
}
