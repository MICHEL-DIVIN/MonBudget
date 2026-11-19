import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Screen, Text } from '@/components/ui';
import { api, getRefreshToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage, isStrongPassword } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

export default function ChangePasswordScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!isStrongPassword(next)) return setError(t('auth.passwordRule'));
    if (next !== confirm) return setError(t('auth.passwordMismatch'));
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next, refresh_token: getRefreshToken() ?? undefined });
      Alert.alert(t('settings.passwordChanged'));
      router.back();
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
      setBusy(false);
    }
  }

  return (
    <Screen keyboard footer={<Button title={t('common.save')} onPress={submit} loading={busy} />}>
      {user?.has_password ? <Field label={t('settings.currentPassword')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" /> : <Text variant="caption" muted>{t('settings.googleNoPassword')}</Text>}
      <Field label={t('auth.newPassword')} value={next} onChangeText={setNext} secureTextEntry textContentType="newPassword" hint={t('auth.passwordRule')} />
      <Field label={t('auth.confirmPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" />
      {error ? <Text variant="label" color={c.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </Screen>
  );
}
