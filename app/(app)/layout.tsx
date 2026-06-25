"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/provider";
import ClientOnly from "@/app/_components/ClientOnly";
import AppShell from "@/app/_components/layout/AppShell";
import DataInitializer from "@/app/_components/DataInitializer";
import { useNotificationEngine } from "@/lib/notifications/engine";
import { usePushNotifications } from "@/lib/notifications/push";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40,
          border: "3px solid #2a2a36",
          borderTopColor: "#8b5cf6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return null;

  return <NotificationRunner>{children}</NotificationRunner>;
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
