"use client";

import { NegotiationRound, AgentProfile } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Props = {
  rounds: NegotiationRound[];
  agents: AgentProfile[];
};

export default function NegotiationTimeline({ rounds, agents }: Props) {
  if (!rounds.length || !agents.length) return null;

  const roundNumbers = Array.from(
    new Set(rounds.map((r) => r.round))
  ).sort((a, b) => a - b);

  const data = roundNumbers.map((round) => {
    const row: any = { round };
    agents.forEach((agent) => {
      const r = rounds.find(
        (rr) => rr.round === round && rr.agentId === agent.id
      );
      row[agent.name] = r?.compositeScore ?? agent.compositeScore;
    });
    return row;
  });

  const maxScore = Math.max(
    ...agents.map((a) => a.compositeScore),
    1
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          Negotiation Timeline
        </h3>
        <span className="text-[10px] text-slate-400">
          Composite scores per round (higher is better).
        </span>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="round"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              domain={[0, 1.2 * maxScore]}
            />
            <Tooltip
              wrapperStyle={{ fontSize: 11 }}
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {agents.map((agent) => (
              <Line
                key={agent.id}
                type="monotone"
                dataKey={agent.name}
                dot={false}
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
