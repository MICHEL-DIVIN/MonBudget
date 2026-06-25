"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/provider";
import { supabase } from "@/lib/supabase/client";

export function usePushNotifications() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user || registered.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    registered.current = true;

    async function setup() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          await saveSubscription(existing, user!.id);
          return;
        }

        if (Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        }

        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });

        await saveSubscription(sub, user!.id);
      } catch {
        // Push not supported or denied
      }
    }

    setup();
  }, [user]);
}

async function saveSubscription(sub: PushSubscription, userId: string) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: json.endpoint,
    keys_p256dh: json.keys.p256dh,
    keys_auth: json.keys.auth,
  }, { onConflict: "endpoint" });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
