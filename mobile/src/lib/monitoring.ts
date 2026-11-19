import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Suivi des crashs et erreurs (Sentry). Point d'entrée unique : changer d'outil
 * (Firebase Crashlytics…) ne demande de modifier que ce fichier.
 *
 * Confidentialité — c'est une app financière :
 *  - aucune donnée personnelle (sendDefaultPii: false), seul l'identifiant interne du compte est attaché ;
 *  - pas de capture d'écran ni de replay de session ;
 *  - les corps de requêtes, les montants et les libellés ne quittent jamais l'appareil (filtrés ci-dessous).
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
export const monitoringEnabled = DSN.length > 0;

export const navigationIntegration = Sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true });

/** Retire tout ce qui pourrait contenir des données financières. */
function scrub<T extends Sentry.Event>(event: T): T {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) delete event.request.headers.Authorization;
  }
  delete event.user?.email;
  delete event.user?.ip_address;
  return event;
}

export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: `monbudget@${Constants.expoConfig?.version ?? '0.0.0'}`,
    sendDefaultPii: false,
    attachScreenshot: false,
    enableAutoSessionTracking: true, // taux de sessions sans crash
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    integrations: [navigationIntegration],
    maxBreadcrumbs: 50,
    beforeSend: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => {
      // Les logs console et les corps HTTP peuvent contenir des montants : on ne garde que la navigation et les URL.
      if (crumb.category === 'console') return null;
      if (crumb.category === 'fetch' || crumb.category === 'xhr') {
        return { ...crumb, data: { url: crumb.data?.url, method: crumb.data?.method, status_code: crumb.data?.status_code } };
      }
      return crumb;
    },
  });
}

/** Associe les erreurs au compte (identifiant interne uniquement, jamais l'email). */
export function setMonitoringUser(id: string | null): void {
  if (!monitoringEnabled) return;
  Sentry.setUser(id ? { id } : null);
}

/** Erreur attendue mais anormale (synchronisation refusée, export impossible…). */
export function reportError(error: unknown, context?: Record<string, string | number | boolean>): void {
  if (!monitoringEnabled) {
    if (__DEV__) console.warn('[monitoring]', error, context);
    return;
  }
  Sentry.withScope((scope) => {
    if (context) scope.setTags(context);
    Sentry.captureException(error);
  });
}

export const wrapRoot = Sentry.wrap;
