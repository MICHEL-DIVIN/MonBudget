"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { validateEmail, sanitizeErrorMessage } from "@/lib/auth/validation";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Entrez votre adresse email");
      return;
    }
    if (!validateEmail(email)) {
      setError("Format d'email invalide");
      return;
    }
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (err) {
      setError(sanitizeErrorMessage(err.message));
    } else {
      setSent(true);
    }
    setSubmitting(false);
  }

  if (sent) {
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
            mark_email_read
          </span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0f0f4", marginBottom: 8 }}>
          Email envoyé
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 8, lineHeight: 1.5 }}>
          Si un compte existe avec <strong style={{ color: "#f0f0f4" }}>{email}</strong>,
          vous recevrez un lien de réinitialisation.
        </p>
        <p style={{ fontSize: 13, color: "#6b6b80", marginBottom: 24 }}>
          Vérifiez aussi vos spams.
        </p>
        <Link href="/login" style={{ color: "#8b5cf6", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
          Retour à la connexion
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
          Mot de passe oublié
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
          Entrez votre email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
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
          {submitting ? "Envoi..." : "Envoyer le lien"}
        </button>
      </form>

      {/* Back */}
      <p style={{ textAlign: "center", fontSize: 14, color: "#6b6b80", marginTop: 28 }}>
        <Link href="/login" style={{ color: "#8b5cf6", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
