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
import { useEffect, useMemo, useRef, useState } from "react";
import { NegotiationRound } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import Confetti from "react-confetti";

function toNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

  // countdown (3 minutes)
  const [timeLeft, setTimeLeft] = useState(180);
  const biddingClosed = timeLeft <= 0;

  // donation adjustments and client-created bidders
  const [donationAdjustments, setDonationAdjustments] = useState<
    Record<string, number>
  >({});
  const [clientAgents, setClientAgents] = useState<any[]>([]);
  const [extraAmount, setExtraAmount] = useState<string>("");

  // confetti state for bottom winner box
  const winnerBoxRef = useRef<HTMLDivElement | null>(null);
  const [confettiSize, setConfettiSize] = useState({ width: 0, height: 0 });
  const [showConfetti, setShowConfetti] = useState(false);

  // timer tick
  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timeLeft]);

  // when a client logs in, create a dedicated bidder row for them (if not already present)
  useEffect(() => {
    if (!user || user.role !== "client") return;

    setClientAgents((prev) => {
      if (prev.some((a) => a.clientName === user.name)) return prev;

      const newId = `client-${prev.length + 1}`;

      const newAgent = {
        id: newId,
        name: user.name,
        displayName: user.name,
        clientName: user.name,
        organization: "Individual Donor",
        donation: 0,
        profileScore: 80,
        fairnessScore: 80,
      };

      return [...prev, newAgent];
    });
  }, [user]);

  // base agents = static AI bidders + all client-created bidders
  const baseAgents = useMemo(
    () => [...MOCK_AGENTS, ...clientAgents],
    [clientAgents]
  );

  // Which agent row belongs to the currently logged-in client?
  const clientAgent = useMemo(() => {
    if (!user || user.role !== "client") return null;
    return clientAgents.find((a) => a.clientName === user.name) ?? null;
  }, [user, clientAgents]);

  // Build agents array with adjusted donations + composite scores
  const agents = useMemo(() => {
    if (!auction) return [];

    const totalWeight = donationWeight + profileWeight + fairnessWeight || 1;

    const normalizedAuction = {
      ...auction,
      donationWeight: donationWeight / totalWeight,
      profileWeight: profileWeight / totalWeight,
      fairnessWeight: fairnessWeight / totalWeight,
    };

    return baseAgents
      .map((agent: any) => {
        const baseDonation = toNumber(agent.donation);
        const extra = donationAdjustments[agent.id] ?? 0;
        const adjustedDonation = baseDonation + extra;

        const agentWithAdjusted: any = {
          ...agent,
          donation: adjustedDonation,
        };

        return {
          ...agentWithAdjusted,
          compositeScore: computeCompositeScore(
            agentWithAdjusted,
            normalizedAuction
          ),
        };
      })
      .sort(
        (a: any, b: any) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0)
      );
  }, [
    auction,
    donationWeight,
    profileWeight,
    fairnessWeight,
    donationAdjustments,
    baseAgents,
  ]);

  if (!auction) {
    return (
      <div className="text-sm text-red-400">
        Auction not found. Please return to the home page.
      </div>
    );
  }

  const winner: any = agents[0];

  // measure winner box size when state changes
  // useEffect(() => {
  //   if (!winnerBoxRef.current) return;
  //   const rect = winnerBoxRef.current.getBoundingClientRect();
  //   setConfettiSize({ width: rect.width, height: rect.height });
  // }, [biddingClosed]);

  // show confetti once when bidding closes
  useEffect(() => {
    if (!biddingClosed || !winner) return;

    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4000); // 4s

    return () => clearTimeout(t);
  }, [biddingClosed, winner]);

  const handleRunSimulation = () => {
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        compositeScore:
          (agents as any[]).find((a) => a.id === r.agentId)?.compositeScore ??
          0,
      }))
    );
  };

  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  const handleBoostDonation = () => {
    if (!clientAgent) return;
    const numeric = Number(extraAmount);
    if (!numeric || isNaN(numeric) || numeric <= 0) return;

    setDonationAdjustments((prev) => ({
      ...prev,
      [clientAgent.id]: (prev[clientAgent.id] ?? 0) + numeric,
    }));

    setExtraAmount("");
  };

  const currentClientRow = clientAgent
    ? (agents as any[]).find((a) => a.id === clientAgent.id)
    : undefined;

  const clientDisplayName =
    user?.name ||
    currentClientRow?.displayName ||
    clientAgent?.displayName ||
    clientAgent?.name ||
    "You";

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
              <span className="font-semibold">
                {winner.displayName || winner.name}
              </span>
            </span>
          )}
        </div>

        {!isAdmin && (
          <span className="text-[11px] text-slate-400">
            You can place your bid while the timer is running. AI bidding logic
            uses your impact profile behind the scenes.
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

          {/* Admin sees all metrics; client sees only Agent + Donation */}
          <AgentTable agents={agents as any[]} showMetrics={isAdmin} />
        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col gap-4">
          {isAdmin && winner && (
            <>
              <MetricsPanel auction={auction} winner={winner} />
              <NegotiationTimeline rounds={rounds} agents={agents as any[]} />
            </>
          )}

          {!isAdmin && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-xs">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
                Boost Your Donation
              </div>
              {clientAgent ? (
                <>
                  <p className="mb-2 text-[11px] text-slate-400">
                    You are bidding as{" "}
                    <span className="font-semibold text-slate-100">
                      {clientDisplayName}
                    </span>
                    . Increase your donation below. Other bidders&apos; amounts
                    are visible but cannot be edited.
                  </p>

                  <div className="mb-3 space-y-1">
                    <div className="text-[11px] text-slate-300">
                      Current donation:
                    </div>
                    <div className="text-sm font-semibold text-emerald-300">
                      {currentClientRow
                        ? currencyFmt.format(
                            toNumber(currentClientRow.donation)
                          )
                        : "—"}
                    </div>
                  </div>

                  <div className="mb-3 space-y-2">
                    <label className="block text-[11px] text-slate-300">
                      Additional donation (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100000"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none focus:border-emerald-500"
                      placeholder="e.g., 5000000"
                      value={extraAmount}
                      onChange={(e) => setExtraAmount(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleBoostDonation}
                    className="w-full rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.99]"
                  >
                    Update donation
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Your bidder profile could not be matched. Please contact the
                  organizers.
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      {/* BOTTOM WINNER BOX WITH CONFETTI */}
      <section
        ref={winnerBoxRef}
        className="relative mt-4 rounded-2xl border border-slate-800 bg-slate-950/90 p-6 text-center text-sm overflow-hidden"
      >
        {/* Confetti only inside this box */}
        {showConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={400}
          />
          )}

        {!winner ? (
          <p className="text-xs text-slate-400">
            Waiting for bidders to join this auction.
          </p>
        ) : !biddingClosed ? (
          <>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              Winner to be announced
            </div>
            <div className="text-xl md:text-2xl font-semibold text-emerald-300">
              Winner to be announced in {minutes}:{seconds}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Leaderboard is still moving. Final winner will be locked when the
              timer hits zero.
            </p>
          </>
        ) : (
          <>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-300/90">
              🏆 Winning Bidder
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-400">
              {winner.displayName || winner.name}
            </div>
            <div className="mt-3 text-xs text-slate-300">
              Final donation:{" "}
              <span className="font-semibold">
                {currencyFmt.format(toNumber(winner.donation))}
              </span>
              {winner.compositeScore != null && (
                <>
                  {" "}
                  • Composite score:{" "}
                  <span className="font-semibold">
                    {winner.compositeScore.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
