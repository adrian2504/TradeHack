import { AuctionTheme } from "@/types";

type Props = {
  auction: AuctionTheme;
  donationWeight: number;
  profileWeight: number;
  fairnessWeight: number;
};

export default function AuctionDetailHeader({
  auction,
  donationWeight,
  profileWeight,
  fairnessWeight,
}: Props) {
  const total = donationWeight + profileWeight + fairnessWeight || 1;

  const wDonation = Math.round((donationWeight / total) * 100);
  const wProfile = Math.round((profileWeight / total) * 100);
  const wFairness = Math.round((fairnessWeight / total) * 100);

  return (
    <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-emerald-500/10 via-slate-950 to-slate-950 p-5 shadow-lg shadow-black/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-300/80">
            {auction.impactArea}
          </p>
          <h2 className="text-xl font-semibold text-slate-50">
            {auction.name}
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-300">
            {auction.description}
          </p>
        </div>
        <div className="rounded-xl bg-slate-950/80 p-3 text-[11px] text-slate-300">
          <div className="font-semibold text-slate-100">
            Current Scoring Weights
          </div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-900 px-2 py-0.5">
              Donation: <span className="font-semibold">{wDonation}%</span>
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5">
              Profile: <span className="font-semibold">{wProfile}%</span>
            </span>
            <span className="rounded-full bg-slate-900 px-2 py-0.5">
              Fairness: <span className="font-semibold">{wFairness}%</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
