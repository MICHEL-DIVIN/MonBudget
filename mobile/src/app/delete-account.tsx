import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Field, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

/** Suppression définitive du compte (et de toutes les données côté serveur). */
export default function DeleteAccountScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { user, deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteAccountFinal'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            await deleteAccount(user?.has_password ? password : undefined);
          } catch (e) {
            setError(errorMessage(e, t('error.network'), t('error.generic')));
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <Screen keyboard>
      <Text variant="body">{t('settings.deleteAccountBody')}</Text>
      {user?.has_password ? <Field label={t('settings.confirmPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" /> : null}
      {error ? <Text variant="label" color={c.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button title={t('settings.deleteAccount')} variant="danger" icon="delete-forever" loading={busy} disabled={user?.has_password && !password} onPress={confirm} />
    </Screen>
  );
}
