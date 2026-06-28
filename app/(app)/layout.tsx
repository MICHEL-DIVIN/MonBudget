"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";
import ClientOnly from "@/app/_components/ClientOnly";
import AppShell from "@/app/_components/layout/AppShell";
import DataInitializer from "@/app/_components/DataInitializer";
import PinLock from "@/app/_components/security/PinLock";
import { useNotificationEngine } from "@/lib/notifications/engine";
import { usePushNotifications } from "@/lib/notifications/push";

const ONBOARDED_KEY = "monbudget-onboarded";

function isOnboarded(userId: string): boolean {
  return localStorage.getItem(`${ONBOARDED_KEY}-${userId}`) === "true";
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (loading || !user) return;
    if (!isOnboarded(user.id) && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-outline-variant border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <PinLock>
      <NotificationRunner>{children}</NotificationRunner>
    </PinLock>
  );
}

function NotificationRunner({ children }: { children: React.ReactNode }) {
  useNotificationEngine();
  usePushNotifications();
  return <>{children}</>;
}

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClientOnly>
      <AuthGuard>
        <DataInitializer />
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </ClientOnly>
  );
}
