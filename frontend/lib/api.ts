// frontend/lib/api.ts

export async function runAuctionSimulation(payload: unknown) {
  // TODO: in the future you can POST to backend /api/v1/run-auction/{auctionId}
  console.log("runAuctionSimulation called with", payload);
  return { ok: true };
}

import { AgentProfile } from "@/types";

export async function fetchLatestAgentsFromBackend(): Promise<AgentProfile[]> {
  const res = await fetch("/api/agents", {
    method: "GET",
    cache: "no-store", // always get latest JSON
  });

  if (!res.ok) {
    throw new Error("Failed to fetch agents from backend");
  }

  const agents = (await res.json()) as AgentProfile[];
  return agents;
}
