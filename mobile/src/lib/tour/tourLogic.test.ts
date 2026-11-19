import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeTourReplay,
  flushPending,
  hasPendingSync,
  isSeenLocally,
  markSeenLocally,
  onTourReplayRequested,
  peekTourReplay,
  requestTourReplay,
  shouldAutoStart,
  type KeyValueStore,
} from './tourLogic';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => (v === null ? data.delete(k) : data.set(k, v)),
  };
}

describe('shouldAutoStart', () => {
  it('démarre uniquement si ni le serveur ni le cache ne disent « vu »', () => {
    expect(shouldAutoStart({ serverSeen: false, localSeen: false })).toBe(true);
    expect(shouldAutoStart({ serverSeen: true, localSeen: false })).toBe(false); // vu sur un autre appareil
    expect(shouldAutoStart({ serverSeen: false, localSeen: true })).toBe(false); // vu ici, serveur pas encore prévenu
    expect(shouldAutoStart({ serverSeen: true, localSeen: true })).toBe(false);
  });
});

describe('markSeenLocally / flushPending', () => {
  const USER = 'user-1';

  it('retient « vu » et « à envoyer » immédiatement', () => {
    const store = memoryStore();
    expect(isSeenLocally(store, USER)).toBe(false);
    markSeenLocally(store, USER);
    expect(isSeenLocally(store, USER)).toBe(true);
    expect(hasPendingSync(store, USER)).toBe(true);
  });

  it('envoie au serveur puis efface le drapeau « en attente » (le « vu » local reste)', async () => {
    const store = memoryStore();
    markSeenLocally(store, USER);
    let calls = 0;
    const result = await flushPending(store, USER, async () => void calls++);
    expect(result).toBe('sent');
    expect(calls).toBe(1);
    expect(hasPendingSync(store, USER)).toBe(false);
    expect(isSeenLocally(store, USER)).toBe(true);
  });

  it('échec réseau : ne lève pas d’erreur et garde « en attente » pour le prochain lancement', async () => {
    const store = memoryStore();
    markSeenLocally(store, USER);
    const result = await flushPending(store, USER, async () => {
      throw new Error('Serveur injoignable');
    });
    expect(result).toBe('failed');
    expect(hasPendingSync(store, USER)).toBe(true);
    // Le lancement suivant réussit.
    expect(await flushPending(store, USER, async () => {})).toBe('sent');
    expect(hasPendingSync(store, USER)).toBe(false);
  });

  it('ne contacte pas le serveur s’il n’y a rien à envoyer', async () => {
    const store = memoryStore();
    let calls = 0;
    expect(await flushPending(store, USER, async () => void calls++)).toBe('nothing');
    expect(calls).toBe(0);
  });

  it('l’état est propre à chaque compte', () => {
    const store = memoryStore();
    markSeenLocally(store, 'alice');
    expect(isSeenLocally(store, 'alice')).toBe(true);
    expect(isSeenLocally(store, 'bob')).toBe(false);
    expect(hasPendingSync(store, 'bob')).toBe(false);
  });
});

describe('requestTourReplay', () => {
  beforeEach(() => void consumeTourReplay());

  it('prévient les écouteurs et n’est consommée qu’une fois', () => {
    let notified = 0;
    const off = onTourReplayRequested(() => notified++);
    requestTourReplay();
    expect(notified).toBe(1);
    expect(peekTourReplay()).toBe(true);
    expect(consumeTourReplay()).toBe(true);
    expect(consumeTourReplay()).toBe(false);
    off();
    requestTourReplay();
    expect(notified).toBe(1); // désabonné
  });
});
