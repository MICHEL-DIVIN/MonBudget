"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    router.replace("/dashboard");
  }, [user, loading, router]);

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center">
      <div className="w-10 h-10 border-[3px] border-outline-variant border-t-primary rounded-full animate-spin" />
    </div>
  );
}
