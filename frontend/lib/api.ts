// Placeholder for future backend calls (e.g., /api/simulate)

export async function runAuctionSimulation(payload: unknown) {
  // In a real implementation, POST to your backend route here.
  console.log("runAuctionSimulation called with", payload);
  return { ok: true };
}

import { AgentProfile } from "@/types";

export async function fetchLatestAgentsFromBackend(): Promise<AgentProfile[]> {
  const res = await fetch("/api/agents", {
    method: "GET",
    // Disable Next.js caching so you always see latest agents
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch agents from backend");
  }

  const agents = (await res.json()) as AgentProfile[];
  return agents;
}
