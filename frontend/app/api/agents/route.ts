import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { AgentProfile } from "@/types";

type UserRow = {
  user_id: string;
  name: string;
  email: string;
  philanthropy_score: number | null;
  socialimpact_score: number | null;
  fairness_score: number | null;
  composite_score: number | null;
  affiliation: string | null;
  strategy: string | null;
  donation: number | null;
};

function getInitials(name: string | null): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

export async function GET() {
  const { data, error } = await supabaseServer
    .from<UserRow>("user")
    .select(
      "user_id,name,email,philanthropy_score,socialimpact_score,fairness_score,composite_score,affiliation,strategy,donation"
    );

  if (error) {
    console.error("Error fetching agents from Supabase:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }

  const agents: AgentProfile[] =
    (data ?? []).map((row: { user_id: any; name: string | null; affiliation: any; donation: any; philanthropy_score: any; socialimpact_score: any; fairness_score: any; composite_score: any; strategy: string; }) => ({
      id: row.user_id,
      name: row.name,
      avatarInitials: getInitials(row.name),
      affiliation: row.affiliation ?? "",
      donationAmount: row.donation ?? 0,
      philanthropyScore: row.philanthropy_score ?? 0,
      socialImpactScore: row.socialimpact_score ?? 0,
      fairnessScore: row.fairness_score ?? 0,
      compositeScore: row.composite_score ?? 0,
      strategy: (row.strategy as AgentProfile["strategy"]) ?? "balanced",
    })) || [];

  return NextResponse.json(agents);
}
