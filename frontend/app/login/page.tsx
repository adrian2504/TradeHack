"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [role, setRole] = useState<"client" | "admin">("client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    login({ name, email, role });

    // where to go after login
    if (role === "admin") {
      router.push("/"); // later you can change to /admin
    } else {
      router.push("/");
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg shadow-black/40">
      <h2 className="text-xl font-semibold text-slate-50">
        Sign in to AgentBazaar
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Clients place bids. Admins create auction postings.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
        <div className="space-y-1">
          <label className="text-xs text-slate-300">Role</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole("client")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                role === "client"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-900 text-slate-300"
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold ${
                role === "admin"
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-900 text-slate-300"
              }`}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Name</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            placeholder="Adrian Rockefeller"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

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

        <button
          type="submit"
          className="mt-2 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:scale-[0.99]"
        >
          Continue as {role === "client" ? "Client" : "Admin"}
        </button>
      </form>
    </section>
  );
}
