/**
 * Logique de la visite guidée, sans dépendance à React ni à React Native (donc testable).
 *
 * Deux sources d'information :
 *  - le serveur (profil de l'utilisateur : `has_seen_tour`) — la source de vérité ;
 *  - un cache local par utilisateur, qui sert à deux choses : ne pas faire « flasher » le tour
 *    avant que le profil soit à jour, et se souvenir qu'il faut encore prévenir le serveur (hors ligne).
 */

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}

/** Clés propres à chaque compte : deux utilisateurs sur le même téléphone ne partagent pas leur état. */
export const tourKeys = (userId: string) => ({
  /** Le tour a été vu sur cet appareil. */
  seen: `tour.seen.${userId}`,
  /** Le serveur n'a pas encore confirmé : à renvoyer au prochain lancement. */
  pending: `tour.pending.${userId}`,
});

/** Le tour démarre seul uniquement si NI le serveur NI le cache local ne disent qu'il a été vu. */
export function shouldAutoStart(input: { serverSeen: boolean; localSeen: boolean }): boolean {
  return !input.serverSeen && !input.localSeen;
}

export function isSeenLocally(store: KeyValueStore, userId: string): boolean {
  return store.get(tourKeys(userId).seen) === '1';
}

export function hasPendingSync(store: KeyValueStore, userId: string): boolean {
  return store.get(tourKeys(userId).pending) === '1';
}

/** « Passer » et « Terminer » : on retient tout de suite, localement, sans attendre le réseau. */
export function markSeenLocally(store: KeyValueStore, userId: string): void {
  const keys = tourKeys(userId);
  store.set(keys.seen, '1');
  store.set(keys.pending, '1');
}

export type FlushResult = 'sent' | 'nothing' | 'failed';

/**
 * Prévient le serveur si c'est en attente. N'élève jamais d'erreur : un échec réseau laisse simplement
 * le drapeau « en attente » en place, et on réessaiera au prochain lancement.
 */
export async function flushPending(store: KeyValueStore, userId: string, send: () => Promise<unknown>): Promise<FlushResult> {
  if (!hasPendingSync(store, userId)) return 'nothing';
  try {
    await send();
    store.set(tourKeys(userId).pending, null);
    return 'sent';
  } catch {
    return 'failed';
  }
}

// --- « Revoir le tutoriel » : demande envoyée depuis les réglages vers l'accueil ---

type Listener = () => void;
let replayRequested = false;
const listeners = new Set<Listener>();

/** Demande de relancer le tour à la main (même s'il a déjà été vu). */
export function requestTourReplay(): void {
  replayRequested = true;
  listeners.forEach((l) => l());
}

/** Consomme la demande : renvoie vrai une seule fois par demande. */
export function consumeTourReplay(): boolean {
  const was = replayRequested;
  replayRequested = false;
  return was;
}

export function peekTourReplay(): boolean {
  return replayRequested;
}

export function onTourReplayRequested(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
