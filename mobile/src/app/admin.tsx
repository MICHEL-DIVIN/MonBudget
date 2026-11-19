import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, Field, Screen, SectionTitle, space, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import type { AdminStats, Profile } from '@/lib/types';
import { errorMessage } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

type Tab = 'stats' | 'users' | 'broadcast' | 'support';
type NotifType = 'info' | 'warning' | 'success' | 'promo';

interface AdminUser extends Profile {
  created_at: string;
}
interface UsersPage {
  total: number;
  items: AdminUser[];
}
interface SupportItem {
  id: string;
  user_email: string | null;
  message: string;
  status: 'new' | 'read' | 'resolved';
  admin_reply: string | null;
  created_at: string;
}

/** Console d'administration (l'API refuse tout appel d'un non-admin : ce n'est qu'une interface). */
export default function AdminScreen() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('stats');
  return (
    <Screen keyboard>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(['stats', 'users', 'broadcast', 'support'] as Tab[]).map((k) => (
          <Chip key={k} label={t(`admin.tab.${k}`)} active={tab === k} onPress={() => setTab(k)} />
        ))}
      </View>
      {tab === 'stats' ? <Stats /> : tab === 'users' ? <Users /> : tab === 'broadcast' ? <Broadcast /> : <SupportInbox />}
    </Screen>
  );
}

function Stats() {
  const { t } = useI18n();
  const { c } = useTheme();
  const { formatAmount } = useCurrency();
  const [s, setS] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.get<AdminStats>('/admin/stats').then(setS).catch((e) => setError(errorMessage(e, t('error.network'), t('error.generic'))));
  }, [t]);
  if (error) return <Text variant="body" color={c.error}>{error}</Text>;
  if (!s) return <Text variant="body" muted>{t('common.loading')}</Text>;
  const rows: [string, string][] = [
    [t('admin.users'), String(s.total_users)],
    [t('admin.newUsers'), String(s.new_users_30d)],
    [t('admin.incomeCount'), String(s.total_revenus)],
    [t('admin.expenseCount'), String(s.total_depenses)],
    [t('admin.incomeSum'), formatAmount(s.sum_revenus)],
    [t('admin.expenseSum'), formatAmount(s.sum_depenses)],
    [t('env.title'), String(s.total_envelopes)],
    [t('nav.savings'), String(s.total_objectifs)],
  ];
  return (
    <Card style={{ gap: space.md }}>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body" muted>{k}</Text>
          <Text variant="body" style={{ fontVariant: ['tabular-nums'] }}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function Users() {
  const { t, intl } = useI18n();
  const { c } = useTheme();
  const [search, setSearch] = useState('');
  const [data, setData] = useState<UsersPage | null>(null);

  const load = useCallback(
    (q: string) => {
      api
        .get<UsersPage>(`/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`)
        .then(setData)
        .catch((e) => Alert.alert(errorMessage(e, t('error.network'), t('error.generic'))));
    },
    [t],
  );
  useEffect(() => {
    const id = setTimeout(() => load(search), 300);
    return () => clearTimeout(id);
  }, [search, load]);

  const toggleRole = (u: AdminUser) => {
    const next = u.role === 'admin' ? 'user' : 'admin';
    Alert.alert(t('admin.changeRole'), t('admin.changeRoleBody', { name: u.full_name || u.email, role: next }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: () =>
          api
            .patch(`/admin/users/${u.id}/role`, { role: next })
            .then(() => load(search))
            .catch((e) => Alert.alert(errorMessage(e, t('error.network'), t('error.generic')))),
      },
    ]);
  };

  return (
    <View style={{ gap: space.md }}>
      <Field label={t('common.search')} value={search} onChangeText={setSearch} autoCapitalize="none" />
      <Text variant="caption" muted>{t('admin.total', { n: data?.total ?? 0 })}</Text>
      {data?.items.map((u) => (
        <Card key={u.id} style={{ gap: 4 }}>
          <Text variant="body">{u.full_name || '—'}</Text>
          <Text variant="caption" muted>{u.email}, {new Date(u.created_at).toLocaleDateString(intl)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text variant="label" color={u.role === 'admin' ? c.primary : c.textMuted}>{u.role}</Text>
            <Button title={u.role === 'admin' ? t('admin.demote') : t('admin.promote')} variant="secondary" onPress={() => toggleRole(u)} />
          </View>
        </Card>
      ))}
    </View>
  );
}

function Broadcast() {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<NotifType>('info');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) return Alert.alert(t('auth.fillAll'));
    Alert.alert(t('admin.broadcastConfirm'), t('admin.broadcastConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.send'),
        onPress: async () => {
          setBusy(true);
          try {
            const r = await api.post<{ recipients: number }>('/admin/notifications', { title: title.trim(), body: body.trim(), type });
            Alert.alert(t('admin.sentTo', { n: r.recipients }));
            setTitle('');
            setBody('');
          } catch (e) {
            Alert.alert(errorMessage(e, t('error.network'), t('error.generic')));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{t('admin.broadcast')}</SectionTitle>
      <Field label={t('admin.title_')} value={title} onChangeText={setTitle} maxLength={100} />
      <Field label={t('support.message')} value={body} onChangeText={setBody} multiline textAlignVertical="top" style={{ minHeight: 90 }} maxLength={500} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {(['info', 'warning', 'success', 'promo'] as NotifType[]).map((k) => (
          <Chip key={k} label={k} active={type === k} onPress={() => setType(k)} />
        ))}
      </View>
      <Button title={t('admin.send')} icon="campaign" loading={busy} onPress={send} />
    </View>
  );
}

function SupportInbox() {
  const { t, intl } = useI18n();
  const [items, setItems] = useState<SupportItem[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api.get<SupportItem[]>('/admin/support').then(setItems).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const update = (id: string, patch: { status?: string; admin_reply?: string }) =>
    api
      .patch(`/admin/support/${id}`, patch)
      .then(load)
      .catch((e) => Alert.alert(errorMessage(e, t('error.network'), t('error.generic'))));

  return (
    <View style={{ gap: space.md }}>
      {items.length === 0 ? <Text variant="body" muted>{t('admin.noSupport')}</Text> : null}
      {items.map((m) => (
        <Card key={m.id} style={{ gap: space.sm }}>
          <Text variant="caption" muted>{m.user_email ?? '—'}, {new Date(m.created_at).toLocaleDateString(intl)}, {t(`support.status.${m.status}`).toLowerCase()}</Text>
          <Text variant="body">{m.message}</Text>
          {m.admin_reply ? <Text variant="label" muted>↳ {m.admin_reply}</Text> : null}
          <Field label={t('support.reply')} value={reply[m.id] ?? ''} onChangeText={(v) => setReply((r) => ({ ...r, [m.id]: v }))} multiline />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={t('admin.reply')} variant="secondary" style={{ flex: 1 }} onPress={() => (reply[m.id]?.trim() ? update(m.id, { admin_reply: reply[m.id].trim(), status: 'resolved' }) : null)} />
            {m.status !== 'resolved' ? <Button title={t('admin.resolve')} variant="ghost" style={{ flex: 1 }} onPress={() => update(m.id, { status: 'resolved' })} /> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}
