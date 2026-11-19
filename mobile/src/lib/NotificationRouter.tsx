import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ACTION_ADD_EXPENSE } from './notifications';

const ALLOWED = ['/', '/transaction', '/analyse', '/budget', '/transactions', '/notifications'];

/**
 * Ouvre l'écran lié à une notification touchée — y compris quand elle a lancé l'app (démarrage à froid).
 * Le bouton d'action « Ajouter une dépense » ouvre directement la saisie.
 */
export function NotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier + response.actionIdentifier;
    if (handled.current === id) return;
    handled.current = id;

    if (response.actionIdentifier === ACTION_ADD_EXPENSE) {
      router.push({ pathname: '/transaction', params: { type: 'expense' } });
      return;
    }
    const url = response.notification.request.content.data?.url;
    // Liste blanche : une notification (push serveur) ne peut pas ouvrir n'importe quelle route.
    if (typeof url === 'string' && ALLOWED.includes(url)) {
      if (url === '/transaction') router.push({ pathname: '/transaction', params: { type: 'expense' } });
      else router.navigate(url as never);
    }
  }, [response]);

  return null;
}
