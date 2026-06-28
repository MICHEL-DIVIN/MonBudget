export interface NotificationPrefs {
  notifications: boolean;
  budgetAlerts: boolean;
  weeklyReport: boolean;
}

const PREFS_KEY = "monbudget-notif-prefs";

const DEFAULTS: NotificationPrefs = {
  notifications: true,
  budgetAlerts: true,
  weeklyReport: false,
};

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        notifications: p.notifications ?? DEFAULTS.notifications,
        budgetAlerts: p.budgetAlerts ?? DEFAULTS.budgetAlerts,
        weeklyReport: p.weeklyReport ?? DEFAULTS.weeklyReport,
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function areNotificationsEnabled(): boolean {
  return getNotificationPrefs().notifications;
}

export function areBudgetAlertsEnabled(): boolean {
  const p = getNotificationPrefs();
  return p.notifications && p.budgetAlerts;
}

export function isWeeklyReportEnabled(): boolean {
  const p = getNotificationPrefs();
  return p.notifications && p.weeklyReport;
}
