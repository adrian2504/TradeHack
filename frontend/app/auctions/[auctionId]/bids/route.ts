// app/auctions/[auctionId]/bids/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer"; // <- make sure this exists
import { AgentProfile, AuctionTheme } from "@/types";
import { computeCompositeScore } from "@/lib/auctions";

type Params = { params: { auctionId: string } };

// Shape of what we expect back from Supabase for a bid row
type BidRow = {
  bid_id: string;
  bid_amount: number;
  user: {
    user_id: string;
    name: string;
    affiliation: string | null;
    philanthropy_score: number | null;
    socialimpact_score: number | null;
    fairness_score: number | null;
  };
};

// Shape of AUCTION row coming from Supabase
type AuctionRow = {
  auction_id: string;
  name: string;
  impact_area: string | null;
  donation_weight: number | null;
  profile_weight: number | null;
  fairness_weight: number | null;
  status: string;
  description: string | null;
};

export async function GET(
  _req: Request,
  { params }: Params
) {
  const auctionId = params.auctionId;

  // 1) Load auction weights from AUCTION
  const { data: auctionRow, error: auctionError } = await supabaseServer
    .from("AUCTION")
    .select(
      "auction_id, name, impact_area, donation_weight, profile_weight, fairness_weight, status, description"
    )
    .eq("auction_id", auctionId)
    .single<AuctionRow>();

  if (auctionError || !auctionRow) {
    console.error("Auction error", auctionError);
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  const auction: AuctionTheme = {
    id: auctionRow.auction_id,
    name: auctionRow.name,
    slug: auctionRow.auction_id, // no dedicated slug column, so reuse id
    description: auctionRow.description ?? "",
    impactArea: auctionRow.impact_area ?? "",
    heroTagline: "",
    donationWeight: Number(auctionRow.donation_weight ?? 0.4),
    profileWeight: Number(auctionRow.profile_weight ?? 0.4),
    fairnessWeight: Number(auctionRow.fairness_weight ?? 0.2),
    status:
      (auctionRow.status?.toLowerCase() as AuctionTheme["status"]) || "live",
  };

  // 2) Get all bids for this auction, most recent first, joined with user
  const { data: bids, error: bidError } = await supabaseServer
    .from("BID")
    .select(
      "bid_id, bid_amount, user:user_id ( user_id, name, affiliation, philanthropy_score, socialimpact_score, fairness_score )"
    )
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: false })
    .returns<BidRow[]>();

  if (bidError) {
    console.error("Bid error", bidError);
    return NextResponse.json({ error: "Failed to load bids" }, { status: 500 });
  }

  // 3) Keep only the latest bid per user
  const latestPerUser = new Map<string, BidRow>();
  for (const b of bids ?? []) {
    const uid = b.user.user_id;
    if (!latestPerUser.has(uid)) {
      latestPerUser.set(uid, b);
    }
  }

  // 4) Build AgentProfile list
  const agents: AgentProfile[] = Array.from(latestPerUser.values()).map(
    (b) => {
      const u = b.user;
      return {
        id: u.user_id,
        name: u.name,
        avatarInitials: u.name.slice(0, 2).toUpperCase(),
        affiliation: u.affiliation ?? "",
        donationAmount: Number(b.bid_amount),
        philanthropyScore: u.philanthropy_score ?? 80,
        socialImpactScore: u.socialimpact_score ?? 80,
        fairnessScore: u.fairness_score ?? 80,
        compositeScore: 0,
        strategy: "client",
      };
    }
  );

  // 5) Sort by composite score using your existing helper
  const withComposite: AgentProfile[] = agents
    .map((agent) => ({
      ...agent,
      compositeScore: computeCompositeScore(agent, auction),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return NextResponse.json({
    agents: withComposite,
    winner: withComposite[0] ?? null,
  });
}

export async function POST(req: Request, { params }: Params) {
  const auctionId = params.auctionId;
  const { userId, amount } = await req.json();

  if (!userId || typeof amount !== "number") {
    return NextResponse.json({ error: "Missing bid data" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("BID").insert({
    bid_id: crypto.randomUUID(),
    user_id: userId,
    auction_id: auctionId,
    bid_amount: amount,
  });

  if (error) {
    console.error("Insert bid error", error);
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
