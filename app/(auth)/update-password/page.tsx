"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { validatePassword, sanitizeErrorMessage } from "@/lib/auth/validation";

function PasswordInput({ value, onChange, placeholder, label }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string; label: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#6b6b80", marginBottom: 6 }}>
        {label}
      </label>
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
    </div>
  );
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(sanitizeErrorMessage(err.message));
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    }
    setSubmitting(false);
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
          Mot de passe modifié
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24 }}>
          Redirection vers la connexion...
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: 16,
            background: "rgba(139,92,246,0.15)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 30, color: "#8b5cf6" }}>
            hourglass_top
          </span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f4", marginBottom: 8 }}>
          Vérification en cours...
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24 }}>
          Si vous n&apos;êtes pas redirigé, le lien a peut-être expiré.
        </p>
        <Link href="/reset-password" style={{ color: "#8b5cf6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
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
            lock_reset
          </span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f0f0f4", margin: 0 }}>
          Nouveau mot de passe
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginTop: 6, marginBottom: 0 }}>
          Choisissez un mot de passe sécurisé
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 caractères, majuscule, chiffre, spécial" label="Nouveau mot de passe" />
        <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Répétez le mot de passe" label="Confirmer" />

        {password.length > 0 && validatePassword(password) && (
          <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
            {validatePassword(password)}
          </p>
        )}

        {confirm.length > 0 && password !== confirm && (
          <p style={{ fontSize: 12, color: "#ef4444", marginBottom: 16, display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
            Les mots de passe ne correspondent pas
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

        <button className="auth-btn-primary" type="submit" disabled={submitting || !password || !confirm || password !== confirm || !!validatePassword(password)}>
          {submitting ? "Modification..." : "Modifier le mot de passe"}
        </button>
      </form>
    </div>
  );
}
