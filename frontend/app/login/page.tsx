
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"client" | "admin">("client");

  // Client fields
  const [clientIsNew, setClientIsNew] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientPasswordConfirm, setClientPasswordConfirm] = useState("");

  // Admin fields
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setClientPassword("");
    setClientPasswordConfirm("");
    setAdminPassword("");
  }, [mode]);

  // -------------------------------
  // CLIENT LOGIN / SIGNUP HANDLER
  // -------------------------------
  const handleClientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !clientPassword.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (clientIsNew) {
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (clientPassword.length < 4) {
        setError("Password must be at least 4 characters.");
        return;
      }
      if (clientPassword !== clientPasswordConfirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      const endpoint = clientIsNew ? "/api/auth/register" : "/api/auth/login";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password: clientPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      login({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
      });

      router.push("/home");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    }
  };

  // -------------------------------
  // ADMIN LOGIN HANDLER (API BASED)
  // -------------------------------
  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError("Enter admin email and password.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail,
          password: adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Invalid admin credentials.");
        return;
      }

      // IMPORTANT: The admin must have role="admin" in Supabase.
      if (data.role !== "admin") {
        setError("You are not authorized as admin.");
        return;
      }

      login({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
      });

      router.push("/home");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-black/40">
      <h2 className="text-xl font-semibold text-slate-50">
        Sign in to AgentBazaar
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Clients can login or create a new account. Admins use their assigned credentials.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-900/80 p-1 text-[11px] font-semibold text-slate-300">
        <button
          type="button"
          onClick={() => setMode("client")}
          className={
            mode === "client"
              ? "rounded-lg bg-emerald-500 text-slate-950 px-2 py-1"
              : "rounded-lg px-2 py-1"
          }
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => setMode("admin")}
          className={
            mode === "admin"
              ? "rounded-lg bg-slate-100 text-slate-950 px-2 py-1"
              : "rounded-lg px-2 py-1"
          }
        >
          Admin
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {/* CLIENT FORM */}
      {mode === "client" && (
        <form onSubmit={handleClientSubmit} className="mt-4 space-y-4 text-sm">
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={clientIsNew}
              onChange={(e) => setClientIsNew(e.target.checked)}
              className="h-3 w-3 rounded border-slate-600 bg-slate-900"
            />
            <span>
              New user?{" "}
              <span className="font-semibold text-emerald-300">
                Create a client account
              </span>
            </span>
          </label>

          {clientIsNew && (
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Full Name</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
                placeholder="Adrian Rockefeller"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
              placeholder="••••••••"
              value={clientPassword}
              onChange={(e) => setClientPassword(e.target.value)}
            />
          </div>

          {clientIsNew && (
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Confirm Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
                placeholder="Repeat your password"
                value={clientPasswordConfirm}
                onChange={(e) => setClientPasswordConfirm(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.99]"
          >
            {clientIsNew ? "Sign Up as Client" : "Login as Client"}
          </button>
        </form>
      )}

      {/* ADMIN FORM */}
      {mode === "admin" && (
        <form onSubmit={handleAdminLogin} className="mt-4 space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Admin Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
              placeholder="admin@example.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Admin Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500"
              placeholder="••••••••"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 active:scale-[0.99]"
          >
            Login as Admin
          </button>
        </form>
      )}
    </section>
  );
}
