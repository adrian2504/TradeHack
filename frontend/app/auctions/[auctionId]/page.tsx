"use client";

import { useParams } from "next/navigation";
import {
  AUCTIONS,
} from "@/lib/auctions";
import AuctionDetailHeader from "@/components/AuctionDetailHeader";
import AgentTable from "@/components/AgentTable";
import ControlPanel from "@/components/ControlPanel";
import MetricsPanel from "@/components/MetricsPanel";
import NegotiationTimeline from "@/components/NegotiationTimeline";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import {AgentProfile, AuctionTheme, NegotiationRound} from "@/types";
import { computeCompositeScore } from "@/lib/auctions";

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

  // No more MOCK_ROUNDS — admin uses this only for timeline visualization
  const [rounds, setRounds] = useState<NegotiationRound[]>([]);

  // Timer
  const [timeLeft, setTimeLeft] = useState(180);
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  const biddingClosed = timeLeft <= 0;

  // Real agents from database
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [winner, setWinner] = useState<AgentProfile | undefined>();

  // Poll state from DB
  useEffect(() => {
    if (!auction) return;

    const auctionId = auction.id;

    const fetchState = async () => {
      const res = await fetch(`/api/auctions/${auctionId}/bids`);
      if (!res.ok) return;
      const data = await res.json();

      setAgents(data.agents);

      if (data.winner) {
        const found = data.agents.find(
          (a: AgentProfile) => a.id === data.winner.id
        );
        if (found) setWinner(found);
      }
    };

    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [auction]);

  // Bidding input
  const [myBid, setMyBid] = useState(0);
  const [bidError, setBidError] = useState<string | null>(null);

  const handlePlaceBid = async () => {
    if (!user) {
      setBidError("Please login first.");
      return;
    }
    if (!auction) return;

    if (myBid <= 0) {
      setBidError("Bid must be greater than 0.");
      return;
    }

    try {
      const res = await fetch(`/api/auctions/${auction.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amount: myBid }),
      });

      if (!res.ok) {
        setBidError("Failed to place bid.");
        return;
      }

      setBidError(null);
    } catch {
      setBidError("Failed to place bid.");
    }
  };

  // Admin simulation triggers a recomputation of timeline data
  const handleRunSimulation = () => {
    if (!agents.length) return;
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        compositeScore:
          agents.find((a) => a.id === r.agentId)?.compositeScore ?? 0,
      }))
    );
  };

  if (!auction) {
    return (
      <div className="text-sm text-red-400">
        Auction not found. Please return to the home page.
      </div>
    );
  }

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
              Winner: <span className="font-semibold">{winner.name}</span>
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
        <div className="flex flex-col gap-4">

          {/* Client bid input */}
          {!isAdmin && !biddingClosed && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl bg-slate-900/70 p-3 text-xs">
              <label className="text-[11px] text-slate-300">
                Your bid amount
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={myBid}
                  onChange={(e) => setMyBid(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <button
                  onClick={handlePlaceBid}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Place bid
                </button>
              </div>

              {bidError && (
                <p className="text-[11px] text-red-400">{bidError}</p>
              )}
            </div>
          )}

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

          <AgentTable agents={agents} showScores={isAdmin} />
        </div>

        <div className="flex flex-col gap-4">
          {isAdmin && winner && (
            <>
              <MetricsPanel auction={auction} winner={winner} />
              <NegotiationTimeline rounds={rounds} agents={agents} />
            </>
          )}
            {!isAdmin && !biddingClosed && (
              <div className="mb-3 flex flex-col gap-2 rounded-xl bg-slate-900/70 p-3 text-xs">
                {user && (
                  <p className="text-[11px] text-slate-300">
                    Logged in as{" "}
                    <span className="font-semibold text-slate-50">{user.name}</span>
                  </p>
                )}

                <label className="mt-1 text-[11px] text-slate-300">
                  Your bid amount
                </label>

                <div className="flex items-center gap-2">
                  {/* input will be updated in the next section */}
                  ...
                </div>

                {bidError && (
                  <p className="text-[11px] text-red-400">{bidError}</p>
                )}
              </div>
            )}

        </div>
      </div>
    </div>
  );
}
