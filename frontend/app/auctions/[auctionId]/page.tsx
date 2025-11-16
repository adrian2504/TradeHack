"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Confetti from "react-confetti";

import { AUCTIONS, computeCompositeScore } from "@/lib/auctions";
import AuctionDetailHeader from "@/components/AuctionDetailHeader";
import AgentTable from "@/components/AgentTable";
import ControlPanel from "@/components/ControlPanel";
import MetricsPanel from "@/components/MetricsPanel";
import NegotiationTimeline from "@/components/NegotiationTimeline";
import { useAuth } from "@/components/AuthProvider";
import { AgentProfile, AuctionTheme, NegotiationRound } from "@/types";
import { fetchLatestAgentsFromBackend } from "@/lib/api";

function ensureAgentShape(agent: AgentProfile): AgentProfile & { donation: number } {
  const donationAmount =
    (agent as any).donationAmount ?? (agent as any).donation ?? 0;

  return {
    ...agent,
    donationAmount,
    // @ts-ignore
    donation: donationAmount,
  } as AgentProfile & { donation: number };
}

export default function AuctionDetailPage() {
  const params = useParams();
  const slug = params.auctionId as string;

  const { user } = useAuth();
  const isAdmin =
    !!user && (user.role === "admin" || user.email === "admin@gmail.com");

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

  const [backendAgents, setBackendAgents] = useState<AgentProfile[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<NegotiationRound[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [bidAmountInput, setBidAmountInput] = useState<string>("");

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [auctionClosed, setAuctionClosed] = useState(false);
  const [hasAutoSimulated, setHasAutoSimulated] = useState(false);

  // ---------------------------------------------------------------------------
  // Load agents from backend JSON (Gemini + clients)
  // ---------------------------------------------------------------------------
  async function reloadAgents() {
    if (!auction) return;
    setLoadingAgents(true);
    setError(null);

    try {
      const agents = await fetchLatestAgentsFromBackend();
      const normalized = agents.map((a) => ensureAgentShape(a));
      setBackendAgents(normalized);
    } catch (err) {
      console.error("Failed to load agents from backend:", err);
      setError("Failed to load agents from backend.");
    } finally {
      setLoadingAgents(false);
    }
  }

  useEffect(() => {
    reloadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, auction]);

  // ---------------------------------------------------------------------------
  // Timer: counts down from 30s after first bid
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const id = setInterval(() => {
      setTimeLeft((prev) => (prev === null ? prev : prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [timeLeft]);

  // ---------------------------------------------------------------------------
  // Combine agents & apply current weights
  // ---------------------------------------------------------------------------
  const auctionWithWeights: AuctionTheme | null = useMemo(() => {
    if (!auction) return null;
    return {
      ...auction,
      donationWeight,
      profileWeight,
      fairnessWeight,
    };
  }, [auction, donationWeight, profileWeight, fairnessWeight]);

  const allAgents: (AgentProfile & { donation?: number })[] = useMemo(() => {
    const normalizedBackend = backendAgents.map((a) => ensureAgentShape(a));
    return [...normalizedBackend];
  }, [backendAgents]);

  const scoredAgents: (AgentProfile & { donation?: number })[] = useMemo(() => {
    if (!auctionWithWeights) return allAgents;

    return allAgents
      .map((agent) => {
        const normalized = ensureAgentShape(agent);
        return {
          ...normalized,
          compositeScore: computeCompositeScore(normalized, auctionWithWeights),
        };
      })
      .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  }, [allAgents, auctionWithWeights]);

  const winner: AgentProfile | undefined = useMemo(() => {
    if (!winnerId) return undefined;
    return scoredAgents.find((a) => a.id === winnerId);
  }, [winnerId, scoredAgents]);

  // ---------------------------------------------------------------------------
  // Simulation: admin or timer triggers rounds + winner selection
  // ---------------------------------------------------------------------------
  function runSimulationNow(
    currentScoredAgents: (AgentProfile & { donation?: number })[],
    currentAuction: AuctionTheme | null
  ) {
    if (!currentAuction || currentScoredAgents.length === 0) return;

    const simRounds: NegotiationRound[] = [];
    const baseTime = Date.now();

    for (let r = 1; r <= 3; r++) {
      currentScoredAgents.forEach((agent) => {
        const donationAmount =
          (agent as any).donationAmount ?? (agent as any).donation ?? 0;

        simRounds.push({
          round: r,
          agentId: agent.id,
          donationAmount,
          compositeScore: agent.compositeScore,
          explanation: `Round ${r}: ${agent.name} at $${donationAmount.toLocaleString()}`,
          timestamp: new Date(baseTime + r * 1000).toISOString(),
        });
      });
    }

    setRounds(simRounds);

    const top = currentScoredAgents[0];
    setWinnerId(top.id);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  }

  function handleRunSimulation() {
    runSimulationNow(scoredAgents, auctionWithWeights);
  }

  // Auto-simulate when timer hits 0
  useEffect(() => {
    if (
      timeLeft === 0 &&
      !hasAutoSimulated &&
      auctionWithWeights &&
      scoredAgents.length > 0
    ) {
      setAuctionClosed(true);
      runSimulationNow(scoredAgents, auctionWithWeights);
      setHasAutoSimulated(true);
    }
  }, [timeLeft, hasAutoSimulated, scoredAgents, auctionWithWeights]);

  // ---------------------------------------------------------------------------
  // Client bid handler — PERSIST to backend (/api/bid) and update state
  // ---------------------------------------------------------------------------
  async function handlePlaceBid() {
    const value = parseFloat(bidAmountInput);
    if (!user || Number.isNaN(value) || value <= 0) return;
    if (auctionClosed) return;

    // Start timer on first bid
    if (timeLeft === null) {
      setTimeLeft(30);
    }

    try {
      const res = await fetch("/api/bid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
          amount: value,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("Bid API error:", data);
        setError(data?.error || "Failed to place bid.");
      } else {
        const data = await res.json();
        const updatedAgent = data.agent as AgentProfile | undefined;

        if (updatedAgent) {
          const normalizedUpdated = ensureAgentShape(updatedAgent);

          // Update backendAgents so the correct row (ert, etc.) reflects the new donation
          setBackendAgents((prev) => {
            let found = false;
            const next = prev.map((a) => {
              if (
                (normalizedUpdated as any).id &&
                a.id === (normalizedUpdated as any).id
              ) {
                found = true;
                return { ...a, ...normalizedUpdated };
              }
              if (
                (normalizedUpdated as any).email &&
                (a as any).email &&
                (a as any).email === (normalizedUpdated as any).email
              ) {
                found = true;
                return { ...a, ...normalizedUpdated };
              }
              return a;
            });

            if (!found) {
              next.push(normalizedUpdated);
            }

            return next;
          });
        }

        setError(null);
      }

      // Optional: also reload from backend to stay in sync with any other updates
      // await reloadAgents();
    } catch (err) {
      console.error("Failed to place bid:", err);
      setError("Failed to place bid.");
    } finally {
      setBidAmountInput("");
    }
  }

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (!auction) {
    return (
      <div className="p-6 text-slate-200">
        <p>Unknown auction.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-200">
        <p className="rounded-xl border border-slate-800 bg-slate-950/80 px-6 py-4 text-sm">
          Please log in to participate in this auction.
        </p>
      </div>
    );
  }

  return (
    <>
      {showConfetti && <Confetti recycle={false} numberOfPieces={400} />}

      <div className="flex flex-col gap-6 pb-10">
        <AuctionDetailHeader
          auction={auction}
          donationWeight={donationWeight}
          profileWeight={profileWeight}
          fairnessWeight={fairnessWeight}
          showWeights={isAdmin}
        />

        <div className="grid gap-5 md:grid-cols-[2fr,1.2fr]">
          <div className="flex flex-col gap-5">
            <AgentTable agents={scoredAgents} showScores />

            {/* Timer + Bid section (hidden for admin) */}
            <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-100">
                  {isAdmin ? "Auction Timer" : "Your Bid"}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {auctionClosed
                    ? "Auction closed"
                    : timeLeft !== null
                    ? `Time left: ${timeLeft}s`
                    : "Timer starts on first bid"}
                </span>
              </div>

              {!isAdmin && (
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={bidAmountInput}
                    onChange={(e) => setBidAmountInput(e.target.value)}
                    placeholder="Enter donation amount"
                    className="h-8 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 outline-none focus:border-emerald-400"
                    disabled={auctionClosed}
                  />
                  <button
                    type="button"
                    onClick={handlePlaceBid}
                    className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                    disabled={auctionClosed}
                  >
                    Place Bid
                  </button>
                </div>
              )}

              {loadingAgents && (
                <p className="mt-2 text-[11px] text-slate-400">
                  Loading AI agents from backend…
                </p>
              )}
              {error && (
                <p className="mt-2 text-[11px] text-red-400">{error}</p>
              )}
            </section>

            <NegotiationTimeline rounds={rounds} agents={scoredAgents} />
          </div>

          <div className="flex flex-col gap-5">
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

            <MetricsPanel auction={auction} winner={winner} />
          </div>
        </div>
      </div>
    </>
  );
}
