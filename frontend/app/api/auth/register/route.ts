import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type JsonUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "client";
  passwordHash: string;
};

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
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Admin account is fixed – don’t allow registering it
  if (email === "admin@gmail.com") {
    return NextResponse.json(
      { error: "Admin account already exists. Please log in as admin." },
      { status: 400 }
    );
  }

  try {
    const json = await loadJson();

    const users: JsonUser[] = Array.isArray(json.users) ? json.users : [];

    const existing = users.find((u) => u.email === email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 400 }
      );
    }

    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const role: "admin" | "client" = "client";
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser: JsonUser = {
      id,
      name,
      email,
      role,
      passwordHash,
    };

    // Save user for auth
    users.push(newUser);
    json.users = users;

    // Also add them as a bidder (agent) with 0 donation
    const agents = Array.isArray(json.agents) ? json.agents : [];
    const initials = (name || email)
      .split(" ")
      .filter(Boolean)
      .map((p: string) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    agents.push({
      id,
      name,
      email,
      avatarInitials: initials,
      affiliation: "Client Bidder",
      donationAmount: 0,
      philanthropyScore: 70,
      socialImpactScore: 70,
      fairnessScore: 70,
      compositeScore: 0,
      strategy: "client",
    });

    json.agents = agents;

    await saveJson(json);

    return NextResponse.json({
      user: {
        id,
        name,
        email,
        role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
