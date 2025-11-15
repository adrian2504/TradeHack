"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function HeaderUserStatus() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  // Hide UI on login page if not authenticated
  if (!user && pathname === "/login") return null;

  // Show login button if not logged in (but not on login page)
  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
      >
        Login
      </Link>
    );
  }

  const isAdmin = user.role === "admin";

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
    >
      {isAdmin ? (
        // 👑 Crown icon for Admin
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-yellow-400"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M3 6l4 4 5-7 5 7 4-4v12H3z" />
        </svg>
      ) : (
        // 👤 Clean avatar icon for Client
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-blue-300"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2a5 5 0 110 10 5 5 0 010-10zm0 12c4.4 0 8 2.69 8 6v2H4v-2c0-3.31 3.6-6 8-6z" />
        </svg>
      )}

      {isAdmin ? "Admin logged in" : "Client logged in"} — Logout
    </button>
  );
}
