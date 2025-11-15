"use client";

type Props = {
  donationWeight: number;
  profileWeight: number;
  fairnessWeight: number;
  setDonationWeight: (v: number) => void;
  setProfileWeight: (v: number) => void;
  setFairnessWeight: (v: number) => void;
  onRunSimulation: () => void;
};

export default function ControlPanel({
  donationWeight,
  profileWeight,
  fairnessWeight,
  setDonationWeight,
  setProfileWeight,
  setFairnessWeight,
  onRunSimulation,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Scoring Controls</h3>
        <span className="text-[10px] text-slate-400">
          Tune how much dollars vs profile vs fairness matter.
        </span>
      </div>

      <div className="space-y-3">
        <SliderRow
          label="Donation weight"
          value={donationWeight}
          onChange={setDonationWeight}
        />
        <SliderRow
          label="Profile weight"
          value={profileWeight}
          onChange={setProfileWeight}
        />
        <SliderRow
          label="Fairness weight"
          value={fairnessWeight}
          onChange={setFairnessWeight}
        />
      </div>

      <button
        onClick={onRunSimulation}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99]"
      >
        Run AI Auction Simulation
      </button>
    </section>
  );
}

type SliderRowProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
};

function SliderRow({ label, value, onChange }: SliderRowProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] text-slate-400">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-emerald-400"
      />
    </div>
  );
}
