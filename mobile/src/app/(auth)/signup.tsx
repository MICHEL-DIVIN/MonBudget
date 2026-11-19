import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { errorMessage, isEmail, isStrongPassword } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

export default function SignupScreen() {
  const { t } = useI18n();
  const { c } = useTheme();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim() || !isEmail(email)) return setError(t('auth.fillAll'));
    if (!isStrongPassword(password)) return setError(t('auth.passwordRule'));
    setBusy(true);
    setError(null);
    try {
      await register(email.trim().toLowerCase(), password, name.trim());
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t('auth.createAccount')} subtitle={t('auth.signupSubtitle')}>
      <Field label={t('auth.fullName')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('auth.passwordRule')} onSubmitEditing={submit} />
      {error ? (
        <Text variant="label" color={c.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('auth.signup')} onPress={submit} loading={busy} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Text variant="body" muted>
          {t('auth.haveAccount')}
        </Text>
        <Link href="/login" style={{ color: c.primary, fontWeight: '700' }}>
          {t('auth.login')}
        </Link>
      </View>
    </AuthShell>
  );
}
