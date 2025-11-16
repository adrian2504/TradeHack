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
  const email = body.email as string;
  const password = body.password as string;
  const mode = (body.mode as string | undefined) ?? undefined;
  const asAdmin = Boolean(body.asAdmin) || mode === "admin";

  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Admin login path (used by Admin tab)
  // ---------------------------------------------------------------------------
  if (asAdmin) {
    if (email !== "admin@gmail.com") {
      // Email is not the admin one – front-end can show "You are not authorized as admin"
      return NextResponse.json(
        { error: "Not admin" },
        { status: 403 }
      );
    }

    if (password !== "admin123") {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Ensure admin is present in JSON users[]
    try {
      const json = await loadJson();
      const users: JsonUser[] = Array.isArray(json.users) ? json.users : [];
      let admin = users.find((u) => u.email === email);

      if (!admin) {
        admin = {
          id: "admin",
          name: "Admin",
          email,
          role: "admin",
          passwordHash: await bcrypt.hash(password, 10),
        };
        users.push(admin);
        json.users = users;
        await saveJson(json);
      }
    } catch (e) {
      console.error("Failed to ensure admin in JSON:", e);
    }

    return NextResponse.json({
      user: {
        id: "admin",
        name: "Admin",
        email,
        role: "admin",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Normal client login path
  // ---------------------------------------------------------------------------
  try {
    const json = await loadJson();
    const users: JsonUser[] = Array.isArray(json.users) ? json.users : [];

    const user = users.find((u) => u.email === email);
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Ensure this user exists in agents[] as bidder
    try {
      const agents = Array.isArray(json.agents) ? json.agents : [];
      const already = agents.find((a: any) => a.email === email);

      if (!already) {
        const initials = (user.name || user.email)
          .split(" ")
          .filter(Boolean)
          .map((p: string) => p[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        agents.push({
          id: user.id,
          name: user.name,
          email: user.email,
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
      }
    } catch (e) {
      console.error("Failed to ensure client in agents:", e);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
