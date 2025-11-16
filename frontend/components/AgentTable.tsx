import { AgentProfile } from "@/types";

type Props = {
  agents: AgentProfile[];
  showScores?: boolean;
};

export default function AgentTable({ agents, showScores = false }: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Bidders
        </h3>

        <span className="text-[10px] text-slate-400">
          Ranked by composite score under current weights.
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800/60">
        <table className="min-w-full border-collapse text-[11px]">
          <thead className="bg-slate-900/90 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">Agent</th>
              <th className="px-3 py-2 text-right">Donation</th>
              <th className="px-3 py-2 text-right">Profile</th>
              <th className="px-3 py-2 text-right">Fairness</th>
              <th className="px-3 py-2 text-right">Composite</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, idx) => {
              const profileScore = Math.round(
                (agent.philanthropyScore + agent.socialImpactScore) / 2
              );
              return (
                <tr
                  key={agent.id}
                  className={
                    idx === 0
                      ? "bg-emerald-500/5"
                      : "odd:bg-slate-900/60 even:bg-slate-950/60"
                  }
                >
                  <td className="px-3 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-100">
                        {agent.avatarInitials}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">
                          {agent.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {agent.affiliation}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right align-middle text-slate-100">
                    ${agent.donationAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    {profileScore}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    {agent.fairnessScore}
                  </td>
                  <td className="px-3 py-2 text-right align-middle font-semibold text-emerald-300">
                    {agent.compositeScore.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
