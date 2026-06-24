"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { clearAllData } from "@/lib/offline/db";
import { sanitizeInput, sanitizeErrorMessage } from "@/lib/auth/validation";
import type { User, Session } from "@supabase/supabase-js";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes d'inactivité

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useUserId(): string {
  const { user } = useAuth();
  return user?.id ?? "";
}

async function ensureProfile(user: User) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!data) {
    const rawName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Utilisateur";
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: sanitizeInput(rawName),
      avatar_url: user.user_metadata?.avatar_url || null,
      currency: "EUR",
      locale: "fr-FR",
    });
  }
}

async function clearSwCache() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    await clearAllData();
    await clearSwCache();
    localStorage.removeItem("monbudget-onboarded");
    localStorage.removeItem("monbudget-last-user-id");
    localStorage.removeItem("monbudget-notif-prefs");
    localStorage.removeItem("monbudget-login-attempts");
    setUser(null);
    setSession(null);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        performSignOut();
      }, SESSION_TIMEOUT_MS);
    }
  }, [user, performSignOut]);

  useEffect(() => {
    if (!user) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) ensureProfile(s.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) ensureProfile(s.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: sanitizeErrorMessage(error.message) };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: sanitizeInput(fullName) } },
    });
    if (error) return { error: sanitizeErrorMessage(error.message) };
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut: performSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
