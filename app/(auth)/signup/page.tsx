"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/provider";
import { validatePassword, validateEmail, sanitizeInput } from "@/lib/auth/validation";

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
        autoComplete="new-password"
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

export default function SignupPage() {
  const router = useRouter();
  const { signUp, signInWithGoogle, loading, user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) router.replace("/dashboard");
  }, [user, loading, router]);

  const pwHint = password.length > 0 ? validatePassword(password) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Remplissez tous les champs");
      return;
    }
    if (!validateEmail(email)) {
      setError("Format d'email invalide");
      return;
    }
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    const cleanName = sanitizeInput(fullName);
    if (cleanName.length < 2) {
      setError("Nom invalide");
      return;
    }
    setError("");
    setSubmitting(true);
    const result = await signUp(email, password, cleanName);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(34,197,94,0.15)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 30, color: "#22c55e" }}>
            check_circle
          </span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f4", marginBottom: 8 }}>
          Vérifiez votre email
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24 }}>
          Un lien de confirmation a été envoyé à{" "}
          <strong style={{ color: "#f0f0f4" }}>{email}</strong>.
        </p>
        <Link href="/login" style={{ color: "#8b5cf6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
          Retour à la connexion
        </Link>
      </div>
    );
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
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f4", margin: 0 }}>Créer un compte</h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginTop: 6, marginBottom: 0 }}>
          Commencez à gérer votre budget
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6b6b80", marginBottom: 6 }}>
            Nom complet
          </label>
          <input
            className="auth-input"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jean Dupont"
            autoComplete="name"
          />
        </div>

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

        <div style={{ marginBottom: 6 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6b6b80", marginBottom: 6 }}>
            Mot de passe
          </label>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 caractères, majuscule, chiffre, spécial" />
        </div>

        {pwHint && (
          <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
            {pwHint}
          </p>
        )}
        {!pwHint && password.length > 0 && (
          <p style={{ fontSize: 12, color: "#22c55e", marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
            Mot de passe valide
          </p>
        )}

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

        <button className="auth-btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#2a2a36" }} />
        <span style={{ fontSize: 12, color: "#6b6b80" }}>ou</span>
        <div style={{ flex: 1, height: 1, background: "#2a2a36" }} />
      </div>

      {/* Google */}
      <button className="auth-btn-google" type="button" onClick={async () => { const r = await signInWithGoogle(); if (r.error) setError(r.error); }}>
        <GoogleIcon />
        Continuer avec Google
      </button>

      {/* Link */}
      <p style={{ textAlign: "center", fontSize: 14, color: "#6b6b80", marginTop: 28 }}>
        Déjà un compte ?{" "}
        <Link href="/login" style={{ color: "#8b5cf6", fontWeight: 600, textDecoration: "none" }}>
          Se connecter
        </Link>
      </p>
    </div>
  );
}
