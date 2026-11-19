import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useCopilot } from 'react-native-copilot';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getMeta, setMeta } from '@/lib/db';
import { useSecurity } from '@/lib/security';
import {
  consumeTourReplay,
  flushPending,
  isSeenLocally,
  markSeenLocally,
  onTourReplayRequested,
  peekTourReplay,
  requestTourReplay,
  shouldAutoStart,
  type KeyValueStore,
} from './tourLogic';
import { TOUR_STEP_COUNT } from './tourSteps';

/** Cache local du « vu » : la base SQLite de l'app (lecture synchrone → aucun éclair avant le chargement du profil). */
const store: KeyValueStore = { get: getMeta, set: setMeta };

/** Délai après le rendu avant de démarrer : laisse finir les animations d'entrée et les mesures de mise en page. */
const START_DELAY_MS = 700;

/**
 * Visite guidée de l'accueil. À appeler dans l'écran qui contient les cibles (<TourTarget>).
 *
 *  - Démarre seule UNE fois par compte, au premier lancement après connexion.
 *  - Attend que toutes les cibles soient rendues (jamais de cible manquante), que l'écran soit au premier
 *    plan et que l'app ne soit pas verrouillée par le code PIN.
 *  - « Passer » et « Terminer » enregistrent toutes deux « vu » : d'abord en local (immédiat), puis sur le
 *    serveur (PATCH /users/me/tour-seen). Si le réseau échoue, on réessaie au prochain lancement, sans
 *    jamais bloquer l'utilisateur.
 *  - Le serveur reste la source de vérité : un tour déjà vu sur un autre appareil ne se relance pas.
 */
export function useProductTour(): void {
  const { user, patchUser } = useAuth();
  const { start, copilotEvents, totalStepsNumber, visible } = useCopilot();
  const { locked } = useSecurity();
  const userId = user?.id ?? null;
  // Profil connu = le serveur a déjà répondu au moins une fois avec ce champ (sinon : on attend, pour ne pas « flasher »).
  const profileKnown = typeof user?.has_seen_tour === 'boolean';
  const serverSeen = user?.has_seen_tour === true;

  const [focused, setFocused] = useState(false);
  const [replay, setReplay] = useState(peekTourReplay);
  /** Le tour vient d'être terminé ou passé pendant cette session : plus de démarrage automatique. */
  const doneThisSession = useRef(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => onTourReplayRequested(() => setReplay(true)), []);

  /** Prévient le serveur si besoin. Ne lève jamais d'erreur. */
  const syncWithServer = useCallback(async () => {
    if (!userId) return;
    const result = await flushPending(store, userId, () => api.patch('/users/me/tour-seen', {}));
    if (result === 'sent') patchUser({ has_seen_tour: true });
  }, [userId, patchUser]);

  // Réessai : à chaque lancement de l'app et à chaque retour au premier plan.
  useEffect(() => {
    void syncWithServer();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncWithServer();
    });
    return () => sub.remove();
  }, [syncWithServer]);

  // « Passer » ET « Terminer » émettent `stop` : on retient « vu » dans les deux cas.
  useEffect(() => {
    if (!userId) return;
    const onStop = () => {
      doneThisSession.current = true;
      markSeenLocally(store, userId);
      void syncWithServer();
    };
    copilotEvents.on('stop', onStop);
    return () => copilotEvents.off('stop', onStop);
  }, [copilotEvents, userId, syncWithServer]);

  // Démarrage : seulement quand tout est prêt.
  useEffect(() => {
    if (!userId || !focused || locked || visible) return;
    if (totalStepsNumber < TOUR_STEP_COUNT) return; // des cibles ne sont pas encore rendues
    const auto = profileKnown && !doneThisSession.current && shouldAutoStart({ serverSeen, localSeen: isSeenLocally(store, userId) });
    if (!replay && !auto) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Le délai laisse finir les animations d'entrée et les mesures de mise en page avant de mesurer les cibles.
    timer = setTimeout(() => {
      if (cancelled) return;
      // Dernière vérification à l'instant du démarrage (l'état a pu changer pendant le délai).
      const stillAuto = !doneThisSession.current && shouldAutoStart({ serverSeen, localSeen: isSeenLocally(store, userId) });
      if (!replay && !stillAuto) return;
      if (replay) {
        consumeTourReplay();
        setReplay(false);
      }
      void start();
    }, START_DELAY_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId, focused, locked, visible, totalStepsNumber, profileKnown, serverSeen, replay, start]);
}

/** « Revoir le tutoriel » (réglages) : retourne à l'accueil, où le tour redémarre à la main. */
export function replayProductTour(): void {
  requestTourReplay();
  router.navigate('/');
}
