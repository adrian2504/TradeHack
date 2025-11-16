import { AuctionTheme } from "@/types";
import { useAuth } from "@/components/AuthProvider";

type Props = {
  auction: AuctionTheme;
  donationWeight: number;
  profileWeight: number;
  fairnessWeight: number;
  showWeights?: boolean;
};

export default function AuctionDetailHeader({
  auction,
  donationWeight,
  profileWeight,
  fairnessWeight,
  showWeights = true,
}: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const total = donationWeight + profileWeight + fairnessWeight || 1;
  const wDonation = Math.round((donationWeight / total) * 100);
  const wProfile = Math.round((profileWeight / total) * 100);
  const wFairness = Math.round((fairnessWeight / total) * 100);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-emerald-300/90">
            {auction.impactArea}
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-50">
            {auction.name}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">
            {auction.description}
          </p>
        </div>

        {showWeights && isAdmin && (
          <div className="mt-2 rounded-xl bg-slate-900/80 p-3 text-[11px] text-slate-200 md:mt-0">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Current Scoring Weights
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-950 px-2 py-0.5">
                Donation: <span className="font-semibold">{wDonation}%</span>
              </span>
              <span className="rounded-full bg-slate-950 px-2 py-0.5">
                Profile: <span className="font-semibold">{wProfile}%</span>
              </span>
              <span className="rounded-full bg-slate-950 px-2 py-0.5">
                Fairness: <span className="font-semibold">{wFairness}%</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
