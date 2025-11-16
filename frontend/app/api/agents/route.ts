import { NextResponse } from "next/server";
import type { AgentProfile } from "@/types";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const edgeInputPath = path.join(
      process.cwd(),
      "..",
      "backend",
      "edge_input.json"
    );

    const fileContent = await fs.promises.readFile(edgeInputPath, "utf-8");
    const data = JSON.parse(fileContent);

    const rounds = Array.isArray(data.rounds) ? data.rounds : [];
    const agentsFromJson = Array.isArray(data.agents) ? data.agents : [];

    // 1) Agents from latest round ranking (Gemini backend)
    let ranking: any[] = [];
    if (rounds.length > 0) {
      const sorted = [...rounds].sort(
        (a, b) => (a.round_index ?? 0) - (b.round_index ?? 0)
      );
      const lastRound = sorted[sorted.length - 1];
      ranking = Array.isArray(lastRound.ranking) ? lastRound.ranking : [];
    }

    const fromRanking: AgentProfile[] = ranking.map((r, idx) => {
      const name = r.name ?? `Agent ${idx + 1}`;
      const initials = name
        .split(" ")
        .filter(Boolean)
        .map((p: string) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const finalScore = typeof r.final_score === "number" ? r.final_score : 0;
      const socialScore =
        typeof r.social_score === "number" ? r.social_score : 0;
      const bid = typeof r.bid === "number" ? r.bid : 0;

      const agent: any = {
        id: r.id ?? `agent-${idx + 1}`,
        name,
        avatarInitials: initials,
        affiliation: "AI Agent",
        donationAmount: bid,
        philanthropyScore: Math.round(socialScore * 100),
        socialImpactScore: Math.round(socialScore * 100),
        fairnessScore: 50,
        compositeScore: Math.round(finalScore * 100),
        strategy: "agent",
      };

      return agent as AgentProfile;
    });

    // 2) Extra agents array (clients we add on register/login)
    const extraAgents: AgentProfile[] = agentsFromJson.map((a: any, idx: number) => {
      const name = a.name ?? a.email ?? `User ${idx + 1}`;
      const initials =
        a.avatarInitials ||
        name
          .split(" ")
          .filter(Boolean)
          .map((p: string) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

      const agent: any = {
        id: a.id ?? `json-agent-${idx + 1}`,
        name,
        email: a.email,
        avatarInitials: initials,
        affiliation: a.affiliation ?? "Client Bidder",
        donationAmount: a.donationAmount ?? 0,
        philanthropyScore: a.philanthropyScore ?? 70,
        socialImpactScore: a.socialImpactScore ?? 70,
        fairnessScore: a.fairnessScore ?? 70,
        compositeScore: a.compositeScore ?? 0,
        strategy: a.strategy ?? "client",
      };

      return agent as AgentProfile;
    });

    // merge & dedupe by id
    const mergedMap = new Map<string, AgentProfile>();
    [...fromRanking, ...extraAgents].forEach((agent) => {
      mergedMap.set(agent.id as string, agent);
    });

    const merged = Array.from(mergedMap.values());

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Error loading agents from edge_input.json:", error);
    return NextResponse.json(
      { error: "Failed to load agents from backend JSON" },
      { status: 500 }
    );
  }
}
