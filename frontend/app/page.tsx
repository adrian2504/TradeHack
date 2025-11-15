"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function IndexRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex h-[60vh] items-center justify-center text-sm text-slate-300">
      Redirecting to login…
    </div>
  );
}
