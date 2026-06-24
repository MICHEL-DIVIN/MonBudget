"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/provider";
import { validateEmail } from "@/lib/auth/validation";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const RATE_KEY = "monbudget-login-attempts";

function getStoredAttempts(): { count: number; lockedUntil: number } {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { count: 0, lockedUntil: 0 };
}

function storeAttempts(count: number, lockedUntil: number) {
  localStorage.setItem(RATE_KEY, JSON.stringify({ count, lockedUntil }));
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        className="auth-input"
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="current-password"
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", padding: 4,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#6b6b80" }}>
          {show ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const lockTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user && !loading) router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    const stored = getStoredAttempts();
    if (stored.lockedUntil > Date.now()) {
      startLockout(Math.ceil((stored.lockedUntil - Date.now()) / 1000));
    }
    return () => { if (lockTimer.current) clearInterval(lockTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startLockout(seconds?: number) {
    setLocked(true);
    let remaining = seconds ?? LOCKOUT_MS / 1000;
    setLockCountdown(remaining);
    if (!seconds) {
      storeAttempts(MAX_ATTEMPTS, Date.now() + LOCKOUT_MS);
    }
    lockTimer.current = setInterval(() => {
      remaining--;
      setLockCountdown(remaining);
      if (remaining <= 0) {
        setLocked(false);
        storeAttempts(0, 0);
        if (lockTimer.current) clearInterval(lockTimer.current);
      }
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!email || !password) {
      setError("Remplissez tous les champs");
      return;
    }
    if (!validateEmail(email)) {
      setError("Format d'email invalide");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await signIn(email, password);
    if (result.error) {
      const stored = getStoredAttempts();
      const newCount = stored.count + 1;
      storeAttempts(newCount, 0);
      if (newCount >= MAX_ATTEMPTS) {
        setError("Trop de tentatives. Compte verrouillé temporairement.");
        startLockout();
      } else {
        setError(`${result.error} (${MAX_ATTEMPTS - newCount} essai(s) restant(s))`);
      }
      setSubmitting(false);
    } else {
      storeAttempts(0, 0);
      router.push("/dashboard");
    }
  }

  return (
    <div>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(139,92,246,0.15)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 28, color: "#8b5cf6" }}>
            account_balance
          </span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f4", margin: 0 }}>MonBudget</h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginTop: 6, marginBottom: 0 }}>
          Connectez-vous à votre compte
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6b6b80", marginBottom: 6 }}>
            Email
          </label>
          <input
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@email.com"
            autoComplete="email"
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6b6b80", marginBottom: 6 }}>
            Mot de passe
          </label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>

        <div style={{ textAlign: "right", marginBottom: 20 }}>
          <Link href="/reset-password" style={{ fontSize: 13, color: "#8b5cf6", textDecoration: "none" }}>
            Mot de passe oublié ?
          </Link>
        </div>

        {error && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 12,
              background: "rgba(239,68,68,0.1)", color: "#ef4444",
              fontSize: 13, marginBottom: 16,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
            {error}
          </div>
        )}

        <button className="auth-btn-primary" type="submit" disabled={submitting || locked}>
          {locked ? `Verrouillé (${lockCountdown}s)` : submitting ? "Connexion..." : "Se connecter"}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#2a2a36" }} />
        <span style={{ fontSize: 12, color: "#6b6b80" }}>ou</span>
        <div style={{ flex: 1, height: 1, background: "#2a2a36" }} />
      </div>

      {/* Google */}
      <button className="auth-btn-google" type="button" onClick={signInWithGoogle}>
        <GoogleIcon />
        Continuer avec Google
      </button>

      {/* Link */}
      <p style={{ textAlign: "center", fontSize: 14, color: "#6b6b80", marginTop: 28 }}>
        Pas encore de compte ?{" "}
        <Link href="/signup" style={{ color: "#8b5cf6", fontWeight: 600, textDecoration: "none" }}>
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
