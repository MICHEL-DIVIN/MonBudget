import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage, isEmail } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

export default function LoginScreen() {
  const { t } = useI18n();
  const { c } = useTheme();
  const { login, expired } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isEmail(email) || !password) {
      setError(t('auth.fillAll'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t('auth.welcomeBack')} subtitle={expired ? t('auth.sessionExpired') : t('auth.loginSubtitle')}>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error ? (
        <Text variant="label" color={c.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('auth.login')} onPress={submit} loading={busy} />
      <Link href="/forgot-password" style={{ textAlign: 'center', color: c.primary, fontWeight: '600', padding: 4 }}>
        {t('auth.forgot')}
      </Link>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text variant="body" muted>
          {t('auth.noAccount')}
        </Text>
        <Link href="/signup" style={{ color: c.primary, fontWeight: '700' }}>
          {t('auth.signup')}
        </Link>
      </View>
    </AuthShell>
  );
}
