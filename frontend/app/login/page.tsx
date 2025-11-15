"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type ClientAccount = {
  name: string;
  email: string;
  password: string;
};

const CLIENTS_KEY = "agentbazaar_clients";

// Hardcoded admin credentials (for hackathon demo)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

function loadClients(): ClientAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveClients(clients: ClientAccount[]) {
  try {
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  } catch {
    // ignore
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  // only two tabs now: client + admin
  const [mode, setMode] = useState<"client" | "admin">("client");

  // client fields
  const [clientIsNew, setClientIsNew] = useState(false); // "New user? Sign up"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientPasswordConfirm, setClientPasswordConfirm] = useState("");

  // admin fields
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  // clear some fields & error when switching between client/admin
  useEffect(() => {
    setError(null);
    setClientPassword("");
    setClientPasswordConfirm("");
    setAdminPassword("");
  }, [mode]);

  const handleClientSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !clientPassword.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    const clients = loadClients();

    if (!clientIsNew) {
      // 🔹 Existing client login
      const existing = clients.find(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );

      if (!existing || existing.password !== clientPassword) {
        setError("Invalid email or password.");
        return;
      }

      login({
        name: existing.name,
        email: existing.email,
        role: "client",
      });

      router.push("/home");
    } else {
      // 🔹 New client signup
      if (!name.trim()) {
        setError("Please enter your full name.");
        return;
      }
      if (clientPassword.length < 4) {
        setError("Password should be at least 4 characters.");
        return;
      }
      if (clientPassword !== clientPasswordConfirm) {
        setError("Passwords do not match.");
        return;
      }

      const existing = clients.find(
        (c) => c.email.toLowerCase() === email.toLowerCase()
      );
      if (existing) {
        setError("An account with this email already exists. Please login.");
        setClientIsNew(false);
        return;
      }

      const newClient: ClientAccount = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: clientPassword,
      };

      const updated = [...clients, newClient];
      saveClients(updated);

      login({
        name: newClient.name,
        email: newClient.email,
        role: "client",
      });

      router.push("/home");
    }
  };

  const handleAdminLogin = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminUsername !== ADMIN_USERNAME || adminPassword !== ADMIN_PASSWORD) {
      setError("Invalid admin credentials.");
      return;
    }

    login({
      name: "Admin",
      email: "admin@agentbazaar.local",
      role: "admin",
    });

    router.push("/home");
  };

  return (
    <section className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-black/40">
      <h2 className="text-xl font-semibold text-slate-50">
        Sign in to AgentBazaar
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Clients can login or create a new account. Admins use their assigned credentials.
      </p>

      {/* Tabs: Client / Admin */}
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

      {/* Error message */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {/* CLIENT TAB */}
      {mode === "client" && (
        <form onSubmit={handleClientSubmit} className="mt-4 space-y-4 text-sm">
          {/* toggle: login vs signup, but same tab */}
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
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
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
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
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

      {/* ADMIN TAB */}
      {mode === "admin" && (
        <form onSubmit={handleAdminLogin} className="mt-4 space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs text-slate-300">Admin Username</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
              placeholder="admin"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-300">Admin Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
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

          <p className="mt-2 text-[10px] text-slate-500">
            Demo creds: username <span className="font-mono">{ADMIN_USERNAME}</span>{" "}
            and password <span className="font-mono">{ADMIN_PASSWORD}</span>.
          </p>
        </form>
      )}
    </section>
  );
}
