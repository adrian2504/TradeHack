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

// simple helper for MM:SS display
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function AuctionDetailPage() {
  const params = useParams();
  const slug = params.auctionId as string;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const auction = AUCTIONS.find((a) => a.slug === slug);

  const [donationWeight, setDonationWeight] = useState(
    auction?.donationWeight ?? 0.4
  );
  const [profileWeight, setProfileWeight] = useState(
    auction?.profileWeight ?? 0.4
  );
  const [fairnessWeight, setFairnessWeight] = useState(
    auction?.fairnessWeight ?? 0.2
  );

  const [rounds, setRounds] = useState<NegotiationRound[]>(MOCK_ROUNDS);

  // ⏱ bidding countdown for clients
  // for hackathon: fixed 90 seconds; you can later load from auction data
  const [timeLeft, setTimeLeft] = useState<number>(90);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const biddingClosed = timeLeft <= 0;

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

  if (!auction) {
    return (
      <div className="text-sm text-red-400">
        Auction not found. Please return to the home page.
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-5">
      {/* header: for clients we hide weights using showWeights flag */}
      <AuctionDetailHeader
        auction={auction}
        donationWeight={donationWeight}
        profileWeight={profileWeight}
        fairnessWeight={fairnessWeight}
        showWeights={isAdmin}
      />

      {/* login + role bar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        {user ? (
          <span>
            Logged in as{" "}
            <span className="font-semibold text-emerald-300">
              {user.name} ({user.role})
            </span>
          </span>
        ) : (
          <a
            href="/login"
            className="text-emerald-300 underline underline-offset-2"
          >
            Login to participate
          </a>
        )}

        {user?.role === "client" && (
          <button className="rounded-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400">
            💰 Place Bid
          </button>
        )}

        {user?.role === "admin" && (
          <button className="rounded-xl bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-sky-400">
            🛠 Create Posting
          </button>
        )}
      </div>

      {/* ADMIN VIEW – full control panel & analytics (unchanged layout) */}
      {isAdmin && (
        <div className="grid gap-5 lg:grid-cols-[2fr,1.4fr]">
          <div className="flex flex-col gap-4">
            <ControlPanel
              donationWeight={donationWeight}
              profileWeight={profileWeight}
              fairnessWeight={fairnessWeight}
              setDonationWeight={setDonationWeight}
              setProfileWeight={setProfileWeight}
              setFairnessWeight={setFairnessWeight}
              onRunSimulation={handleRunSimulation}
            />
            <AgentTable agents={agents} />
          </div>

          <div className="flex flex-col gap-4">
            <MetricsPanel auction={auction} winner={winner} />
            <NegotiationTimeline rounds={rounds} agents={agents} />
          </div>
        </div>
      )}

      {/* CLIENT VIEW – ONLY bidders table + time left + winner */}
      {!isAdmin && (
        <div className="flex flex-col gap-4">
          {/* timer bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-400">Time left to bid:</span>
              <span className="text-base font-semibold text-emerald-300">
                {biddingClosed ? "00:00" : formatTime(timeLeft)}
              </span>
            </div>
            <span
              className={
                biddingClosed
                  ? "rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-slate-300"
                  : "rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300"
              }
            >
              {biddingClosed ? "Bidding closed" : "Open for bids"}
            </span>
          </div>

          {/* winner card – ONLY when time is over */}
          {biddingClosed && winner && (
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


          {/* AI bidders table – always visible to clients */}
          <AgentTable agents={agents} />
        </div>
      )}
    </div>
  );
}
