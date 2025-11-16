"use client";

import React from "react";
import { AgentProfile } from "@/types";

interface Props {
  agents: AgentProfile[];
  showScores?: boolean;
}

export default function AgentTable({ agents, showScores = false }: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">Bidders</h3>
        <p className="text-[10px] text-slate-400">
          {agents.length} participants
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="py-2">Name</th>
              <th className="py-2">Donation</th>
              {showScores && (
                <>
                  <th className="py-2">Social Impact</th>
                  <th className="py-2">Philanthropy</th>
                  <th className="py-2">Fairness</th>
                  <th className="py-2">Composite Score</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {agents.map((agent) => {
              const donation =
                (agent as any).donationAmount ??
                (agent as any).donation ??
                0;

              return (
                <tr key={agent.id} className="border-b border-slate-900">
                  <td className="py-2">
                    <span className="font-medium text-slate-100">
                      {agent.name}
                    </span>
                  </td>

                  <td className="py-2">
                    ${donation.toLocaleString()}
                  </td>

                  {showScores && (
                    <>
                      <td className="py-2">{agent.socialImpactScore}</td>
                      <td className="py-2">{agent.philanthropyScore}</td>
                      <td className="py-2">{agent.fairnessScore}</td>
                      <td className="py-2 font-semibold text-emerald-400">
                        {agent.compositeScore?.toFixed(2)}
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
