import { AgentProfile, AuctionTheme } from "@/types";

type Props = {
  auction: AuctionTheme;
  winner?: AgentProfile;
};

export default function MetricsPanel({ auction, winner }: Props) {
  if (!winner) return null;

  const profileScore = Math.round(
    (winner.philanthropyScore + winner.socialImpactScore) / 2
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">
        Outcome Snapshot
      </h3>

      <div className="space-y-3">
        <div className="rounded-xl bg-slate-900/80 p-3">
          <div className="text-[10px] uppercase tracking-wide text-emerald-300/90">
            Current Winner
          </div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-50">
                {winner.name}
              </div>
              <div className="text-[10px] text-slate-400">
                {winner.affiliation}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">
                Composite Score
              </div>
              <div className="text-lg font-semibold text-emerald-300">
                {winner.compositeScore.toFixed(2)}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-300">
            Under the current weights, {winner.name} wins despite{" "}
            {winner.donationAmount.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}{" "}
            not necessarily being the largest check, because their profile and
            fairness scores align more strongly with the{" "}
            <span className="font-semibold">{auction.impactArea}</span> impact
            goals.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Donation" value={`$${(winner.donationAmount / 1_000_000).toFixed(1)}M`} />
          <Metric label="Profile Score" value={profileScore} />
          <Metric label="Fairness Score" value={winner.fairnessScore} />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-slate-900/80 p-3">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}
