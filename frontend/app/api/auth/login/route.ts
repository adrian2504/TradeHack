import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin123";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Missing credentials" },
      { status: 400 }
    );
  }

  // 1) Hard-coded admin login (does NOT use Supabase)
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return NextResponse.json({
      id: "admin-fixed-id", // any constant string is fine
      name: "Admin",
      email: ADMIN_EMAIL,
      role: "admin" as const,
    });
  }

  // 2) Normal user login via Supabase
  const { data, error } = await supabaseServer
    .from("user")
    .select("user_id, name, email, password")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const passwordMatches = await bcrypt.compare(password, data.password);
  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  // All DB users are treated as clients
  return NextResponse.json({
    id: data.user_id,
    name: data.name,
    email: data.email,
    role: "client" as const,
  });
}
