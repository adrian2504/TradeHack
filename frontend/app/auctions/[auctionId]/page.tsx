"use client";

import { useParams } from "next/navigation";
import {
  AUCTIONS,
  MOCK_AGENTS,
  computeCompositeScore,
  MOCK_ROUNDS,
} from "@/lib/auctions";
import AuctionDetailHeader from "@/components/AuctionDetailHeader";
import AgentTable from "@/components/AgentTable";
import ControlPanel from "@/components/ControlPanel";
import MetricsPanel from "@/components/MetricsPanel";
import NegotiationTimeline from "@/components/NegotiationTimeline";
import { useEffect, useMemo, useState } from "react";
import { AgentProfile, NegotiationRound } from "@/types";
import { useAuth } from "@/components/AuthProvider";

export default function AuctionDetailPage() {
  const params = useParams();
  const slug = params.auctionId as string;

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Find auction (may be undefined for bad slug, but hooks still run fine)
  const auction = AUCTIONS.find((a) => a.slug === slug);

  // Scoring weights (used by admin only, but hooks run for everyone)
  const [donationWeight, setDonationWeight] = useState(
    auction?.donationWeight ?? 0.4
  );
  const [profileWeight, setProfileWeight] = useState(
    auction?.profileWeight ?? 0.4
  );
  const [fairnessWeight, setFairnessWeight] = useState(
    auction?.fairnessWeight ?? 0.2
  );

  // Negotiation rounds (for timeline / simulation)
  const [rounds, setRounds] = useState<NegotiationRound[]>(MOCK_ROUNDS);

  // Simple bidding countdown timer (always defined; UI uses it for client)
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes for example

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const biddingClosed = timeLeft <= 0;

  // Compute agents with composite score, sorted
  const agents: AgentProfile[] = useMemo(() => {
    if (!auction) return [];
    const totalWeight = donationWeight + profileWeight + fairnessWeight || 1;

    const normalizedAuction = {
      ...auction,
      donationWeight: donationWeight / totalWeight,
      profileWeight: profileWeight / totalWeight,
      fairnessWeight: fairnessWeight / totalWeight,
    };

    return MOCK_AGENTS.map((agent) => ({
      ...agent,
      compositeScore: computeCompositeScore(agent, normalizedAuction),
    })).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [auction, donationWeight, profileWeight, fairnessWeight]);

  const winner = agents[0];

  const handleRunSimulation = () => {
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        compositeScore:
          agents.find((a) => a.id === r.agentId)?.compositeScore ?? 0,
      }))
    );
  };

  // NOTE: this check is AFTER all hooks, and auction doesn't change between renders
  if (!auction) {
    return (
      <div className="text-sm text-red-400">
        Auction not found. Please return to the home page.
      </div>
    );
  }

  // Helper: format time as mm:ss
  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col gap-5">
      <AuctionDetailHeader
        auction={auction}
        donationWeight={donationWeight}
        profileWeight={profileWeight}
        fairnessWeight={fairnessWeight}
      />

      {/* Bidding status row */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2 py-1 text-[11px]">
            {biddingClosed ? "Bidding Closed" : "Bidding Open"}
          </span>
          {!biddingClosed && (
            <span className="text-emerald-300">
              Time left to bid:{" "}
              <span className="font-semibold">
                {minutes}:{seconds}
              </span>
            </span>
          )}
          {biddingClosed && winner && (
            <span className="text-emerald-300">
              Winner:{" "}
              <span className="font-semibold">{winner.name}</span>
            </span>
          )}
        </div>

        {!isAdmin && (
          <span className="text-[11px] text-slate-400">
            You can place your bid while the timer is running. AI bidding
            logic uses your impact profile behind the scenes.
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[2fr,1.4fr]">
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-4">
          {isAdmin && (
            <ControlPanel
              donationWeight={donationWeight}
              profileWeight={profileWeight}
              fairnessWeight={fairnessWeight}
              setDonationWeight={setDonationWeight}
              setProfileWeight={setProfileWeight}
              setFairnessWeight={setFairnessWeight}
              onRunSimulation={handleRunSimulation}
            />
          )}

          {/* AI Bidders table is visible to both admin and clients */}
          <AgentTable agents={agents} />
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col gap-4">
          {isAdmin && winner && (
            <>
              <MetricsPanel auction={auction} winner={winner} />
              <NegotiationTimeline rounds={rounds} agents={agents} />
            </>
          )}

          {!isAdmin && winner && biddingClosed && (
            <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/90">
                Winning Bidder
              </div>
              <div className="text-sm font-semibold text-slate-50">
                {winner.name}
              </div>
              <p className="mt-1 text-[11px] text-slate-300">
                Composite score:{" "}
                <span className="font-semibold">
                  {winner.compositeScore.toFixed(2)}
                </span>
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
