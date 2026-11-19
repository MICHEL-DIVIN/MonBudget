import { router } from 'expo-router';
import { useState } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { errorMessage, isEmail, isStrongPassword } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

/** Deux étapes : demande du code par email, puis saisie du code et du nouveau mot de passe. */
export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const { c } = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!isEmail(email)) return setError(t('auth.invalidEmail'));
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() }, { auth: false });
      setStep('code');
      setInfo(t('auth.codeSent'));
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!/^\d{6}$/.test(code)) return setError(t('auth.codeInvalid'));
    if (!isStrongPassword(password)) return setError(t('auth.passwordRule'));
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { email: email.trim().toLowerCase(), code, new_password: password }, { auth: false });
      router.replace('/login');
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={step === 'email' ? t('auth.resetSubtitle') : info ?? undefined}>
      <Field label={t('auth.email')} value={email} onChangeText={setEmail} editable={step === 'email'} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      {step === 'code' ? (
        <>
          <Field label={t('auth.code')} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" />
          <Field label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" hint={t('auth.passwordRule')} />
        </>
      ) : null}
      {error ? (
        <Text variant="label" color={c.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {step === 'email' ? (
        <Button title={t('auth.sendCode')} onPress={sendCode} loading={busy} />
      ) : (
        <>
          <Button title={t('auth.resetPassword')} onPress={reset} loading={busy} />
          <Button title={t('auth.resendCode')} variant="ghost" onPress={sendCode} disabled={busy} />
        </>
      )}
      <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
    </AuthShell>
  );
}
