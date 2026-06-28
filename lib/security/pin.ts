const PIN_HASH_KEY = "monbudget-pin-hash";
const PIN_ENABLED_KEY = "monbudget-pin-enabled";
const PIN_SALT_KEY = "monbudget-pin-salt";
const PIN_ATTEMPTS_KEY = "monbudget-pin-attempts";
const PIN_LOCKOUT_KEY = "monbudget-pin-lockout";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

function getOrCreateSalt(): string {
  let salt = localStorage.getItem(PIN_SALT_KEY);
  if (!salt) {
    salt = crypto.randomUUID();
    localStorage.setItem(PIN_SALT_KEY, salt);
  }
  return salt;
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`monbudget:${salt}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isPinEnabled(): boolean {
  try {
    return localStorage.getItem(PIN_ENABLED_KEY) === "true" && !!localStorage.getItem(PIN_HASH_KEY);
  } catch {
    return false;
  }
}

export function isPinLockedOut(): boolean {
  try {
    const until = localStorage.getItem(PIN_LOCKOUT_KEY);
    if (!until) return false;
    if (Date.now() < Number(until)) return true;
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    return false;
  } catch {
    return false;
  }
}

export function getPinLockoutRemainingMs(): number {
  const until = localStorage.getItem(PIN_LOCKOUT_KEY);
  if (!until) return 0;
  return Math.max(0, Number(until) - Date.now());
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
  const salt = getOrCreateSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(PIN_HASH_KEY, hash);
  localStorage.setItem(PIN_ENABLED_KEY, "true");
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (isPinLockedOut()) return false;
  const stored = localStorage.getItem(PIN_HASH_KEY);
  const salt = localStorage.getItem(PIN_SALT_KEY);
  if (!stored || !salt) return false;

  const ok = (await hashPin(pin, salt)) === stored;
  if (ok) {
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    return true;
  }

  const attempts = Number(localStorage.getItem(PIN_ATTEMPTS_KEY) ?? "0") + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts));
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(PIN_LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
  }
  return false;
}

export function removePin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_ENABLED_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}
