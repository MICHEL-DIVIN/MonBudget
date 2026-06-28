"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";

const ONBOARDED_KEY = "monbudget-onboarded";

function isOnboarded(userId: string): boolean {
  return localStorage.getItem(`${ONBOARDED_KEY}-${userId}`) === "true";
}

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isOnboarded(user.id)) {
      router.replace("/onboarding");
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
