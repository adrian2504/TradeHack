import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getEdgeInputPath() {
  // frontend/ → ../backend/edge_input.json
  return path.join(process.cwd(), "..", "backend", "edge_input.json");
}

async function loadJson(): Promise<any> {
  const edgePath = getEdgeInputPath();

  if (!fs.existsSync(edgePath)) {
    return {};
  }

  const raw = await fs.promises.readFile(edgePath, "utf-8");
  return JSON.parse(raw || "{}");
}

async function saveJson(json: any) {
  const edgePath = getEdgeInputPath();
  await fs.promises.writeFile(edgePath, JSON.stringify(json, null, 2), "utf-8");
}

export async function POST(req: Request) {
  const body = await req.json();

  const userId = (body.userId as string | undefined) || undefined;
  const email = (body.email as string | undefined) || undefined;
  const rawName = (body.name as string | undefined) || undefined;
  const name = rawName?.trim();
  const amount = Number(body.amount);

  if (!amount || isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Invalid bid amount" },
      { status: 400 }
    );
  }

  try {
    const json = await loadJson();
    const agents = Array.isArray(json.agents) ? json.agents : [];

    // Decide a display name and a stable id even if nothing was sent
    const displayName = name || email || "Client Bidder";
    const initials = displayName
      .split(" ")
      .filter(Boolean)
      .map((p: string) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Try to find existing agent in this order:
    // 1) id match
    // 2) email match
    // 3) name match
    let idx = -1;

    if (userId) {
      idx = agents.findIndex((a: any) => a.id === userId);
    }
    if (idx === -1 && email) {
      idx = agents.findIndex(
        (a: any) =>
          a.email &&
          typeof a.email === "string" &&
          a.email.toLowerCase() === email.toLowerCase()
      );
    }
    if (idx === -1 && name) {
      idx = agents.findIndex(
        (a: any) => a.name && typeof a.name === "string" && a.name === name
      );
    }
    // As an absolute fallback, use a shared "client-bidder" row so we never error
    if (idx === -1) {
      idx = agents.findIndex((a: any) => a.id === "client-bidder");
    }

    let agent: any;
    if (idx !== -1) {
      agent = agents[idx];
    } else {
      // Create new agent row
      agent = {
        id: userId ?? email ?? name ?? "client-bidder",
        name: displayName,
        email,
        avatarInitials: initials,
        affiliation: "Client Bidder",
        donationAmount: 0,
        philanthropyScore: 80,
        socialImpactScore: 50,
        fairnessScore: 70,
        compositeScore: 0,
        strategy: "client",
      };
      agents.push(agent);
      idx = agents.length - 1;
    }

    const currentDonation = Number(agent.donationAmount || 0);
    agent.donationAmount = currentDonation + amount;

    json.agents = agents;
    await saveJson(json);

    return NextResponse.json({ agent });
  } catch (err) {
    console.error("Bid error:", err);
    return NextResponse.json(
      { error: "Failed to record bid" },
      { status: 500 }
    );
  }
}
