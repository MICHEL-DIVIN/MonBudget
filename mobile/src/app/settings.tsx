import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Button, Card, Chip, Field, radius, Row, Screen, Segmented, SectionTitle, space, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { CURRENCIES, useCurrency } from '@/lib/currency';
import { exportCsv } from '@/lib/export';
import { useI18n } from '@/lib/i18n';
import { getNotificationPrefs, registerForPush, requestPermission, saveNotificationPrefs, scheduleReminders, unregisterPush, type NotificationPrefs } from '@/lib/notifications';
import { monitoringEnabled, reportError } from '@/lib/monitoring';
import { removePin } from '@/lib/pin';
import { replayProductTour } from '@/lib/tour/useProductTour';
import { useSecurity } from '@/lib/security';
import { syncNow, useSyncStatus } from '@/lib/sync';
import { errorMessage } from '@/lib/validation';
import { useTheme, type ThemeMode } from '@/theme/theme';

export default function SettingsScreen() {
  const { c, mode, setMode } = useTheme();
  const { t, locale, setLocale, intl } = useI18n();
  const { currency, setCurrency, formatAmount } = useCurrency();
  const { user, updateProfile, signOut } = useAuth();
  const { pinEnabled, setPinEnabled } = useSecurity();
  const sync = useSyncStatus();
  const [prefs, setPrefs] = useState(getNotificationPrefs);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user?.full_name ?? '');
  const [busy, setBusy] = useState<string | null>(null);

  const netError = (e: unknown) => Alert.alert(errorMessage(e, t('error.network'), t('error.generic')));

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(t('settings.photoPermission'));
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setBusy('avatar');
    try {
      // 256 px suffisent pour un avatar et gardent l'image sous la limite de l'API.
      const img = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 256, height: 256 } }], {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      });
      await updateProfile({ avatar_url: `data:image/jpeg;base64,${img.base64}` });
    } catch (e) {
      netError(e);
    } finally {
      setBusy(null);
    }
  }

  async function saveName() {
    if (!name.trim()) return;
    setBusy('name');
    try {
      await updateProfile({ full_name: name.trim() });
      setEditingName(false);
    } catch (e) {
      netError(e);
    } finally {
      setBusy(null);
    }
  }

  async function updatePrefs(patch: Partial<NotificationPrefs>) {
    const next = { ...prefs, ...patch };
    // Activer un rappel = le bon moment pour demander l'autorisation au système.
    if (Object.values(patch).some((v) => v === true) && !(await requestPermission())) {
      Alert.alert(t('settings.notifDenied'));
      return;
    }
    setPrefs(next);
    saveNotificationPrefs(next);
    if (patch.notifications !== undefined) void (patch.notifications ? registerForPush() : unregisterPush());
    void scheduleReminders({ t, fmt: formatAmount });
  }

  const togglePref = (key: keyof NotificationPrefs, value: boolean) => void updatePrefs({ [key]: value });


  async function togglePin(on: boolean) {
    if (on) return router.push('/pin-setup');
    Alert.alert(t('settings.pinRemove'), t('settings.pinRemoveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.pinRemove'),
        style: 'destructive',
        onPress: async () => {
          await removePin();
          setPinEnabled(false);
        },
      },
    ]);
  }

  async function logout() {
    const ok = await signOut();
    if (ok) return;
    // Des modifications n'ont pas pu être envoyées : on laisse l'utilisateur décider en connaissance de cause.
    Alert.alert(t('settings.unsyncedTitle'), t('settings.unsyncedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logoutAnyway'), style: 'destructive', onPress: () => void signOut({ force: true }) },
    ]);
  }

  const lastSync = sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString(intl) : t('sync.never');
  const syncLabel = sync.state === 'syncing' ? t('sync.syncing') : sync.state === 'offline' ? t('sync.offline') : sync.state === 'error' ? t('sync.error') : sync.pending > 0 ? t('sync.pending', { n: sync.pending }) : t('sync.upToDate');

  return (
    <Screen keyboard>
      {/* Profil */}
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={{ width: 72, height: 72 }} accessibilityLabel={t('settings.avatar')} />
            ) : (
              <Text variant="title" color={c.onPrimary}>{(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>{user?.full_name || t('settings.member')}</Text>
            <Text variant="caption" muted numberOfLines={1}>{user?.email}</Text>
            {user?.role === 'admin' ? <Text variant="caption" color={c.primary}>Admin</Text> : null}
          </View>
        </View>
        {editingName ? (
          <View style={{ gap: space.sm }}>
            <Field label={t('auth.fullName')} value={name} onChangeText={setName} autoFocus />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setEditingName(false)} style={{ flex: 1 }} />
              <Button title={t('common.save')} loading={busy === 'name'} onPress={saveName} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={t('settings.editName')} variant="secondary" icon="edit" onPress={() => setEditingName(true)} style={{ flex: 1 }} />
            <Button title={t('settings.changePhoto')} variant="secondary" icon="photo-camera" loading={busy === 'avatar'} onPress={pickAvatar} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      {/* Affichage */}
      <SectionTitle>{t('settings.appearance')}</SectionTitle>
      <Card style={{ gap: space.lg }}>
        <View style={{ gap: 6 }}>
          <Text variant="label" muted>{t('settings.theme')}</Text>
          <Segmented<ThemeMode> value={mode} onChange={setMode} options={[{ value: 'light', label: t('settings.themeLight') }, { value: 'dark', label: t('settings.themeDark') }, { value: 'system', label: t('settings.themeAuto') }]} />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="label" muted>{t('settings.language')}</Text>
          <Segmented value={locale} onChange={setLocale} options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="label" muted>{t('settings.currency')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {CURRENCIES.map((cur) => (
              <Chip key={cur} label={cur} active={currency === cur} onPress={() => setCurrency(cur)} />
            ))}
          </View>
        </View>
      </Card>

      {/* Notifications */}
      <SectionTitle>{t('settings.notifications')}</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        <PrefRow label={t('settings.pushNotifs')} value={prefs.notifications} onChange={(v) => togglePref('notifications', v)} />
        <PrefRow label={t('settings.budgetAlerts')} value={prefs.budgetAlerts} disabled={!prefs.notifications} onChange={(v) => togglePref('budgetAlerts', v)} />
        <PrefRow label={t('settings.weeklyReport')} hint={t('settings.weeklyReportHint')} value={prefs.weeklyReport} disabled={!prefs.notifications} onChange={(v) => togglePref('weeklyReport', v)} />
        <PrefRow label={t('settings.billReminders')} hint={t('settings.billRemindersHint')} value={prefs.billReminders} disabled={!prefs.notifications} onChange={(v) => togglePref('billReminders', v)} />
        <PrefRow label={t('settings.dailyReminder')} hint={t('settings.dailyReminderHint')} value={prefs.dailyReminder} disabled={!prefs.notifications} onChange={(v) => togglePref('dailyReminder', v)} />
        {prefs.notifications && prefs.dailyReminder ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.sm }}>
            {[8, 12, 19, 20, 21, 22].map((h) => (
              <Chip key={h} label={`${h} h`} active={prefs.reminderHour === h} onPress={() => void updatePrefs({ reminderHour: h })} />
            ))}
          </View>
        ) : null}
      </Card>

      {/* Synchronisation */}
      <SectionTitle>{t('settings.sync')}</SectionTitle>
      <Card style={{ gap: space.sm }}>
        <Row icon={sync.state === 'offline' ? 'cloud-off' : 'cloud-done'} title={syncLabel} subtitle={`${t('sync.last')} : ${lastSync}`} />
        {sync.state === 'error' && sync.error ? <Text variant="caption" color={c.error}>{sync.error}</Text> : null}
        {sync.rejected > 0 ? <Text variant="caption" color={c.warning}>{t('sync.rejected', { n: sync.rejected })}</Text> : null}
        <Button title={t('sync.now')} variant="secondary" icon="sync" loading={sync.state === 'syncing'} onPress={() => void syncNow()} />
      </Card>

      {/* Sécurité */}
      <SectionTitle>{t('settings.security')}</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        <PrefRow label={t('settings.pin')} hint={t('settings.pinDesc')} value={pinEnabled} onChange={togglePin} />
        <Row icon="lock-outline" title={user?.has_password ? t('settings.changePassword') : t('settings.setPassword')} onPress={() => router.push('/change-password')} />
      </Card>

      {/* Données */}
      <SectionTitle>{t('settings.data')}</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        <Row icon="donut-large" title={t('env.title')} onPress={() => router.navigate('/budget')} />
        <Row icon="file-download" title={t('settings.exportCsv')} onPress={() => exportCsv().catch(netError)} />
        <Row icon="file-upload" title={t('settings.importTx')} onPress={() => router.push('/import')} />
      </Card>

      {/* Aide */}
      <SectionTitle>{t('settings.help')}</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        <Row icon="school" title={t('settings.replayTour')} subtitle={t('settings.replayTourHint')} onPress={replayProductTour} />
        <Row icon="support-agent" title={t('support.title')} onPress={() => router.push('/support')} />
        {user?.role === 'admin' ? <Row icon="admin-panel-settings" title={t('admin.title')} onPress={() => router.push('/admin')} /> : null}
        {__DEV__ && monitoringEnabled ? (
          <Row
            icon="bug-report"
            title="Envoyer une erreur de test (dev)"
            subtitle="Vérifie que Sentry reçoit bien les erreurs"
            onPress={() => {
              reportError(new Error('Erreur de test envoyée depuis Mon Budget'), { area: 'test' });
              Alert.alert('Erreur de test envoyée', 'Elle apparaît dans Sentry > Issues sous une minute.');
            }}
          />
        ) : null}
      </Card>

      <Button title={t('settings.logout')} variant="secondary" icon="logout" onPress={logout} />
      <Button title={t('settings.deleteAccount')} variant="danger" icon="delete-forever" onPress={() => router.push('/delete-account')} />
      <Text variant="caption" muted style={{ textAlign: 'center' }}>Mon Budget</Text>
    </Screen>
  );
}

function PrefRow({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {hint ? <Text variant="caption" muted>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: c.primary, false: c.outline }} accessibilityLabel={label} />
    </View>
  );
}
