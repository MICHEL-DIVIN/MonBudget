import { ApiError } from './api';

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Mêmes règles que l'API : 8 caractères minimum, au moins une lettre et un chiffre. */
export const isStrongPassword = (v: string) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);

/** Message d'erreur affichable ; les erreurs réseau sont traduites par l'appelant via `networkMessage`. */
export function errorMessage(e: unknown, networkMessage: string, fallback: string): string {
  if (e instanceof ApiError) return e.isNetwork ? networkMessage : e.message;
  return fallback;
}
