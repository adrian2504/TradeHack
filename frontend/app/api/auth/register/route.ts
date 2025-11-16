import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Check if user already exists
  const { data: existing, error: existingErr } = await supabaseServer
    .from("user")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (existingErr) {
    console.error("Existing user check error", existingErr);
    return NextResponse.json(
      { error: "Server error while checking existing user" },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 400 }
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const userId = crypto.randomUUID();

  const { data, error } = await supabaseServer
    .from("user")
    .insert({
      user_id: userId,
      name,
      email,
      password: hash,
      // set safe defaults for non-null numeric columns
      philanthropy_score: 80,
      socialimpact_score: 80,
      fairness_score: 80,
      donation: 0,
      composite_score: 0,
    })
    .select("user_id, name, email")
    .single();

  if (error) {
    console.error("Create user error", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to create user" },
      { status: 500 }
    );
  }

  // We treat all registered users as "client" in the app
  return NextResponse.json({
    id: data.user_id,
    name: data.name,
    email: data.email,
    role: "client",
  });
}
