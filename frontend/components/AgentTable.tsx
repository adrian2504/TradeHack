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
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-900/80 text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Agent</th>
              <th className="px-4 py-3 text-right font-medium">Donation</th>
              {showMetrics && (
                <>
                  <th className="px-4 py-3 text-right font-medium">Profile</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Fairness
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Composite
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, idx) => {
              const donationNumber = toNumber(agent.donation);
              const name = agent.displayName || agent.name || "AI Bidder";

              const initialsSource = agent.avatarInitials || agent.initials || name;
              const initials = String(initialsSource).slice(0, 2).toUpperCase();

              return (
                <tr
                  key={agent.id}
                  className={
                    idx % 2 === 0
                      ? "bg-slate-950/40"
                      : "bg-slate-900/40 border-t border-slate-900/60"
                  }
                >
                  {/* Agent name + mini badge */}
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-200">
                        {initials}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-50">
                          {name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {agent.organization || agent.subtitle || ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Donation */}
                  <td className="px-4 py-3 text-right align-middle text-slate-100">
                    {currencyFmt.format(donationNumber)}
                  </td>

                  {/* Metrics only for admin */}
                  {showMetrics && (
                    <>
                      <td className="px-4 py-3 text-right align-middle text-slate-100">
                        {agent.profileScore ?? "--"}
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-slate-100">
                        {agent.fairnessScore ?? "--"}
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-emerald-300">
                        {agent.compositeScore != null
                          ? agent.compositeScore.toFixed(2)
                          : "--"}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
