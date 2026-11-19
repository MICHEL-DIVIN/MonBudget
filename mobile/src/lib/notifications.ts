import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';
import { computeMonthlySnapshot } from './calculations';
import { daysInMonth } from './dates';
import { getJsonMeta, getMeta, setJsonMeta, setMeta } from './db';
import { monthForecast, upcomingBetween, upcomingRecurring } from './forecast';
import { listAll, listWithDeleted } from './repo';

/**
 * Notifications de l'app. Deux familles :
 *  - planifiées sur le téléphone (rappel du soir, échéances la veille, bilan du lundi, fin de mois) :
 *    elles arrivent même app fermée et sans réseau, puisque le système les déclenche lui-même ;
 *  - push serveur (messages de l'équipe), via le service Expo.
 * Toucher une notification ouvre l'écran indiqué dans `data.url`.
 */

// --- Préférences ---

export interface NotificationPrefs {
  notifications: boolean;
  budgetAlerts: boolean;
  weeklyReport: boolean;
  dailyReminder: boolean;
  reminderHour: number;
  billReminders: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { notifications: true, budgetAlerts: true, weeklyReport: true, dailyReminder: true, reminderHour: 20, billReminders: true };

export const getNotificationPrefs = (): NotificationPrefs => ({ ...DEFAULT_PREFS, ...getJsonMeta<Partial<NotificationPrefs>>('pref.notifications', {}) });
export const saveNotificationPrefs = (p: NotificationPrefs) => setJsonMeta('pref.notifications', p);

// --- Configuration ---

export const ACTION_ADD_EXPENSE = 'add-expense';
const CATEGORY_QUICK_ADD = 'quick-add';
const PREFIX = 'mb-';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

type Tr = { t: (key: string, vars?: Record<string, string | number>) => string; fmt: (n: number) => string };

/** Canaux Android + catégorie avec bouton d'action « Ajouter une dépense ». */
async function configure(t: Tr['t']) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: t('notif.channelReminders'), importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#E2B356' });
    await Notifications.setNotificationChannelAsync('alerts', { name: t('notif.channelAlerts'), importance: Notifications.AndroidImportance.HIGH, lightColor: '#F0725C' });
    await Notifications.setNotificationChannelAsync('default', { name: t('notif.channelNews'), importance: Notifications.AndroidImportance.DEFAULT });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY_QUICK_ADD, [
    { identifier: ACTION_ADD_EXPENSE, buttonTitle: t('notif.actionAddExpense'), options: { opensAppToForeground: true } },
  ]);
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function hasPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Demande l'autorisation (au bon moment : quand l'utilisateur active un rappel). */
export async function requestPermission(): Promise<boolean> {
  try {
    return await ensurePermission();
  } catch {
    return false;
  }
}

// --- Push serveur ---

const projectId = () => Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Enregistre l'appareil pour les push serveur. Ne lève jamais. */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice || !getNotificationPrefs().notifications) return;
    if (!(await ensurePermission())) return;
    const id = projectId();
    if (!id) return; // sans projet EAS, Expo ne délivre pas de jeton push (les rappels locaux fonctionnent quand même)
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.post('/push/register', { token, platform: Platform.OS });
  } catch {
    /* non bloquant */
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    const id = projectId();
    if (!id) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.delete('/push/register', { token });
  } catch {
    /* non bloquant */
  }
}

// --- Rappels planifiés (déclenchés par le système, app fermée) ---

const at = (d: Date, hour: number, minute = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
const fromDay = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const MAX_BILLS = 20; // iOS limite à 64 notifications planifiées par app

/**
 * Replanifie tous les rappels à partir des données actuelles. Appelé au démarrage, après chaque
 * changement de données et quand les préférences changent. Idempotent.
 */
export async function scheduleReminders({ t, fmt }: Tr, now = new Date()): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

    const prefs = getNotificationPrefs();
    if (!prefs.notifications || !(await hasPermission())) return;
    await configure(t);

    // Rappel du soir pour noter les dépenses du jour, avec bouton « Ajouter une dépense ».
    if (prefs.dailyReminder) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}daily`,
        content: { title: t('notif.dailyTitle'), body: t('notif.dailyBody'), categoryIdentifier: CATEGORY_QUICK_ADD, data: { url: '/transaction' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: prefs.reminderHour, minute: 0, channelId: 'reminders' },
      });
    }

    // Bilan de la semaine, le lundi matin.
    if (prefs.weeklyReport) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}weekly`,
        content: { title: t('notif.weeklyTitle'), body: t('notif.weeklyBody'), data: { url: '/analyse' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 9, minute: 0, channelId: 'reminders' },
      });
    }

    const revenus = listAll('revenus');
    const depenses = listAll('depenses');

    // Échéances récurrentes : la veille à 9 h (loyer, abonnements…) sur les 45 prochains jours.
    if (prefs.billReminders) {
      const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 45);
      const bills = upcomingBetween([], listWithDeleted('depenses'), now, until).slice(0, MAX_BILLS);
      for (const b of bills) {
        const day = fromDay(b.date);
        const when = at(new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1), 9);
        if (when <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}bill-${b.id}`,
          content: { title: t('notif.billTitle', { label: b.label }), body: t('notif.billBody', { amount: fmt(b.amount) }), data: { url: '/' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'alerts' },
        });
      }
    }

    // Dernier jour du mois, 18 h : où en est-on ?
    if (prefs.budgetAlerts) {
      const lastDay = at(new Date(now.getFullYear(), now.getMonth(), daysInMonth(now.getFullYear(), now.getMonth())), 18);
      if (lastDay > now) {
        const snap = computeMonthlySnapshot(revenus, depenses, listAll('envelopes'), now.getMonth(), now.getFullYear());
        const f = monthForecast(snap.totalRevenus, snap.totalDepenses, upcomingRecurring(listWithDeleted('revenus'), listWithDeleted('depenses'), now), now);
        if (revenus.length + depenses.length > 0) {
          await Notifications.scheduleNotificationAsync({
            identifier: `${PREFIX}month-end`,
            content: {
              title: t('notif.monthEndTitle'),
              body: f.leftToSpend >= 0 ? t('notif.monthEndBody', { amount: fmt(f.leftToSpend) }) : t('notif.monthEndOver', { amount: fmt(-f.leftToSpend) }),
              data: { url: '/analyse' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: lastDay, channelId: 'reminders' },
          });
        }
      }
    }
  } catch {
    /* les rappels ne doivent jamais bloquer l'app */
  }
}

// --- Alertes immédiates (pendant l'utilisation) ---
// Chaque alerte n'est envoyée qu'une fois (clé mémorisée) pour ne pas harceler l'utilisateur.

const SEEN_KEY = 'notif.seen';

function markOnce(key: string): boolean {
  const seen = getJsonMeta<string[]>(SEEN_KEY, []);
  if (seen.includes(key)) return false;
  setJsonMeta(SEEN_KEY, [...seen.slice(-199), key]);
  return true;
}

async function notify(title: string, body: string, url: string) {
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body, data: { url } }, trigger: Platform.OS === 'android' ? { channelId: 'alerts' } : null });
  } catch {
    /* permission refusée : ignoré */
  }
}

export async function runLocalAlerts({ t, fmt }: Tr, now = new Date()): Promise<void> {
  const prefs = getNotificationPrefs();
  if (!prefs.notifications || !(await hasPermission())) return;

  const month = now.getMonth();
  const year = now.getFullYear();

  if (prefs.budgetAlerts) {
    const snap = computeMonthlySnapshot(listAll('revenus'), listAll('depenses'), listAll('envelopes'), month, year);
    for (const e of snap.envelopeDetails) {
      if (e.budgeted <= 0) continue;
      if (e.status === 'over' && markOnce(`over:${e.id}:${year}-${month}`)) {
        await notify(t('alert.envelopeOverTitle', { name: e.name }), t('alert.envelopeOverBody', { amount: fmt(-e.remaining) }), '/budget');
      } else if (e.status === 'warning' && markOnce(`warn:${e.id}:${year}-${month}`)) {
        await notify(t('alert.envelopeWarnTitle', { name: e.name }), t('alert.envelopeWarnBody', { pct: Math.round(e.percent), left: fmt(e.remaining) }), '/budget');
      }
    }
    if (snap.balance < 0 && markOnce(`deficit:${year}-${month}`)) {
      await notify(t('alert.deficitTitle'), t('alert.deficitBody', { amount: fmt(-snap.balance) }), '/');
    }
  }

  for (const o of listAll('objectifs')) {
    if (o.target_amount > 0 && o.current_amount >= o.target_amount && markOnce(`goal:${o.id}`)) {
      await notify(t('alert.goalTitle'), t('alert.goalBody', { label: o.label }), '/budget');
    }
  }
}

export const lastAlertRun = () => Number(getMeta('notif.lastRun') ?? 0);
export const touchAlertRun = () => setMeta('notif.lastRun', String(Date.now()));
