"use client";

import { useParams } from "next/navigation";
import { AUCTIONS, MOCK_AGENTS, computeCompositeScore, MOCK_ROUNDS } from "@/lib/auctions";
import AuctionDetailHeader from "@/components/AuctionDetailHeader";
import AgentTable from "@/components/AgentTable";
import ControlPanel from "@/components/ControlPanel";
import MetricsPanel from "@/components/MetricsPanel";
import NegotiationTimeline from "@/components/NegotiationTimeline";
import { useMemo, useState } from "react";
import { AgentProfile, NegotiationRound } from "@/types";
import { useAuth } from "@/components/AuthProvider";

export default function AuctionDetailPage() {
  const params = useParams();
  const slug = params.auctionId as string;
  const { user } = useAuth();


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
      <AuctionDetailHeader
        auction={auction}
        donationWeight={donationWeight}
        profileWeight={profileWeight}
        fairnessWeight={fairnessWeight}
      />
      
       {/* NEW AUTH UI SECTION */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
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
      {/* END AUTH UI SECTION */}


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
    </div>
  );
}
