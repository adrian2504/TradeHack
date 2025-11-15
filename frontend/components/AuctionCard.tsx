import { AuctionTheme } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  auction: AuctionTheme;
  showScoringMix?: boolean;
};

export default function AuctionCard({ auction, showScoringMix = true }: Props) {
  return (
    <div
      className={cn(
        "group flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200 shadow-lg shadow-black/40 transition-all hover:-translate-y-0.5 hover:border-emerald-500/70 hover:shadow-emerald-500/25"
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">
          {auction.impactArea}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            auction.status === "live"
              ? "bg-emerald-500/10 text-emerald-300"
              : auction.status === "upcoming"
              ? "bg-sky-500/10 text-sky-300"
              : "bg-slate-700/40 text-slate-300"
          )}
        >
  {auction.status}
</span>

      </div>

      <h3 className="text-sm font-semibold text-slate-50">
        {auction.name}
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">{auction.heroTagline}</p>

      <p className="mt-2 line-clamp-3 text-xs text-slate-400/80">
        {auction.description}
      </p>

      {/* scoring mix: only show when showScoringMix is true (admins) */}
      {showScoringMix && (
        <div className="mt-3 rounded-xl bg-slate-900/80 p-3 text-[11px] text-slate-300">
          <div className="mb-1 font-semibold text-slate-200">
            Scoring Mix (Weighting)
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5">
              Donation:{" "}
              <span className="font-semibold">
                {Math.round(auction.donationWeight * 100)}%
              </span>
            </span>
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5">
              Profile:{" "}
              <span className="font-semibold">
                {Math.round(auction.profileWeight * 100)}%
              </span>
            </span>
            <span className="rounded-full bg-slate-950/70 px-2 py-0.5">
              Fairness:{" "}
              <span className="font-semibold">
                {Math.round(auction.fairnessWeight * 100)}%
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>View auction details</span>
        <span className="inline-flex items-center gap-1 text-emerald-300 transition-transform group-hover:translate-x-0.5">
          Open
          <span aria-hidden>↗</span>
        </span>
      </div>
    </div>
  );
}
