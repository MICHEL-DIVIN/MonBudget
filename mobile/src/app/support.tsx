import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Field, Screen, SectionTitle, space, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { errorMessage } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

interface Ticket {
  id: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  admin_reply: string | null;
  created_at: string;
}

const FAQ = ['offline', 'recurring', 'envelopes', 'currency', 'export', 'data'] as const;

export default function SupportScreen() {
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Ticket[]>('/support').then(setTickets).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function send() {
    if (message.trim().length < 5) return Alert.alert(t('support.tooShort'));
    setBusy(true);
    try {
      await api.post('/support', { message: message.trim() });
      setMessage('');
      Alert.alert(t('support.sent'));
      load();
    } catch (e) {
      Alert.alert(errorMessage(e, t('error.network'), t('error.generic')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard>
      <SectionTitle>{t('support.contact')}</SectionTitle>
      <Card style={{ gap: space.md }}>
        <Field label={t('support.message')} value={message} onChangeText={setMessage} multiline numberOfLines={5} textAlignVertical="top" style={{ minHeight: 110 }} maxLength={4000} placeholder={t('support.placeholder')} />
        <Button title={t('support.send')} icon="send" loading={busy} onPress={send} />
      </Card>

      {tickets.length > 0 ? (
        <>
          <SectionTitle>{t('support.history')}</SectionTitle>
          {tickets.map((k) => (
            <Card key={k.id} style={{ gap: 6 }}>
              <Text variant="label" muted>{new Date(k.created_at).toLocaleDateString(intl)}, {t(`support.status.${k.status}`).toLowerCase()}</Text>
              <Text variant="body">{k.message}</Text>
              {k.admin_reply ? (
                <View style={{ backgroundColor: c.primaryFixed, borderRadius: 10, padding: space.md, gap: 2 }}>
                  <Text variant="caption" color={c.primary}>{t('support.reply')}</Text>
                  <Text variant="label" style={{ fontWeight: '400' }}>{k.admin_reply}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>{t('support.faq')}</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>
        {FAQ.map((k) => (
          <Pressable key={k} accessibilityRole="button" accessibilityState={{ expanded: open === k }} onPress={() => setOpen(open === k ? null : k)} style={{ paddingVertical: space.md, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text variant="body" style={{ flex: 1 }}>{t(`faq.${k}.q`)}</Text>
              <Icon name={open === k ? 'expand-less' : 'expand-more'} size={22} color={c.textMuted} />
            </View>
            {open === k ? <Text variant="label" muted style={{ fontWeight: '400' }}>{t(`faq.${k}.a`)}</Text> : null}
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
