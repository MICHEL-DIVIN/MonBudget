import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getMeta, setMeta } from './db';

const HASH_KEY = 'mb.pin.hash';
const SALT_KEY = 'mb.pin.salt';
const ATTEMPTS_KEY = 'pin.attempts';
const LOCKOUT_KEY = 'pin.lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `monbudget:${salt}:${pin}`);
}

// Le hash vit dans le stockage sécurisé du système (Keychain / Keystore), pas dans la base locale.
export async function isPinEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(HASH_KEY)) !== null;
}

export function lockoutRemainingMs(): number {
  const until = Number(getMeta(LOCKOUT_KEY) ?? 0);
  return Math.max(0, until - Date.now());
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits');
  const salt = Crypto.randomUUID();
  await SecureStore.setItemAsync(SALT_KEY, salt);
  await SecureStore.setItemAsync(HASH_KEY, await hashPin(pin, salt));
  setMeta(ATTEMPTS_KEY, null);
  setMeta(LOCKOUT_KEY, null);
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (lockoutRemainingMs() > 0) return false;
  const [stored, salt] = await Promise.all([SecureStore.getItemAsync(HASH_KEY), SecureStore.getItemAsync(SALT_KEY)]);
  if (!stored || !salt) return false;

  if ((await hashPin(pin, salt)) === stored) {
    setMeta(ATTEMPTS_KEY, null);
    setMeta(LOCKOUT_KEY, null);
    return true;
  }
  const attempts = Number(getMeta(ATTEMPTS_KEY) ?? 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    setMeta(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
    setMeta(ATTEMPTS_KEY, null);
  } else {
    setMeta(ATTEMPTS_KEY, String(attempts));
  }
  return false;
}

export async function removePin(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(HASH_KEY), SecureStore.deleteItemAsync(SALT_KEY)]);
  setMeta(ATTEMPTS_KEY, null);
  setMeta(LOCKOUT_KEY, null);
}
