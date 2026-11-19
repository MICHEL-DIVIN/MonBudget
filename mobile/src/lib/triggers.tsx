import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useCurrency } from './currency';
import { dataChanged, localMutation } from './events';
import { useI18n } from './i18n';
import { NotificationRouter } from './NotificationRouter';
import { registerForPush, runLocalAlerts, scheduleReminders } from './notifications';
import { generateRecurring } from './recurring-runner';
import { scheduleSync, syncNow } from './sync';

const PERIODIC_MS = 5 * 60_000;

/**
 * Pilote la synchronisation automatique (sans rien afficher) :
 * au premier plan, au retour du réseau, après chaque modification, et périodiquement.
 */
export function SyncTriggers() {
  const { t } = useI18n();
  const { formatAmount } = useCurrency();
  const tr = useRef({ t, fmt: formatAmount });
  tr.current = { t, fmt: formatAmount };

  useEffect(() => {
    void registerForPush().then(() => scheduleReminders(tr.current));
    generateRecurring();
    void syncNow();

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        generateRecurring(); // un nouveau mois a pu commencer pendant que l'app dormait
        void syncNow();
        void scheduleReminders(tr.current);
      }
    });
    const netSub = Network.addNetworkStateListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) void syncNow();
    });
    const unsubMutation = localMutation.subscribe(() => scheduleSync());
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, PERIODIC_MS);

    // Alertes locales (dépassement d'enveloppe, objectif atteint…) peu après un changement de données.
    let alertTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubData = dataChanged.subscribe(() => {
      if (alertTimer) clearTimeout(alertTimer);
      alertTimer = setTimeout(() => {
        void runLocalAlerts(tr.current).catch(() => {});
        // Les rappels planifiés (échéances, fin de mois) dépendent des données : on les recalcule.
        void scheduleReminders(tr.current);
      }, 3000);
    });

    return () => {
      appSub.remove();
      netSub.remove();
      unsubMutation();
      unsubData();
      clearInterval(timer);
      if (alertTimer) clearTimeout(alertTimer);
    };
  }, []);

  // Langue ou devise changée : les textes des rappels planifiés doivent suivre.
  useEffect(() => {
    void scheduleReminders(tr.current);
  }, [t, formatAmount]);

  return <NotificationRouter />;
}
