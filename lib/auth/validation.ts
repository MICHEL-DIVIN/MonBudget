export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Minimum 8 caractères";
  if (!/[A-Z]/.test(password)) return "Au moins une majuscule requise";
  if (!/[a-z]/.test(password)) return "Au moins une minuscule requise";
  if (!/[0-9]/.test(password)) return "Au moins un chiffre requis";
  if (!/[^A-Za-z0-9]/.test(password)) return "Au moins un caractère spécial requis (!@#$...)";
  return null;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sanitizeInput(str: string, maxLen = 100): string {
  return str.replace(/[<>"'&]/g, "").trim().slice(0, maxLen);
}

export function sanitizeErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  const safe: [string, string][] = [
    ["invalid login credentials", "Identifiants incorrects"],
    ["email not confirmed", "Veuillez confirmer votre email"],
    ["user already registered", "Si ce compte existe, un email de confirmation sera envoyé"],
    ["email rate limit exceeded", "Trop de tentatives. Réessayez dans quelques minutes."],
    ["rate limit", "Trop de tentatives. Réessayez dans quelques minutes."],
    ["password should be at least", "Le mot de passe est trop court"],
    ["new password should be different", "Le nouveau mot de passe doit être différent de l'ancien"],
    ["email link is invalid or has expired", "Le lien a expiré. Demandez un nouveau lien."],
    ["unable to validate email", "Impossible de valider l'email"],
    ["signup is disabled", "Les inscriptions sont temporairement désactivées"],
  ];
  for (const [key, msg] of safe) {
    if (lower.includes(key)) return msg;
  }
  return "Une erreur est survenue. Réessayez.";
}
