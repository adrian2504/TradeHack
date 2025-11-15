"use client";

import { AuctionTheme } from "@/types";
import AuctionCard from "./AuctionCard";

type Props = {
  auctions: AuctionTheme[];
  onSelect: (auction: AuctionTheme) => void;
};

export default function AuctionGrid({ auctions, onSelect }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {auctions.map((auction) => (
        <button
          key={auction.id}
          onClick={() => onSelect(auction)}
          className="text-left"
        >
          <AuctionCard auction={auction} />
        </button>
      ))}
    </div>
  );
}
