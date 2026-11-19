import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, EmptyState, radius, space, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { AppNotification } from '@/lib/types';
import { errorMessage } from '@/lib/validation';
import { useTheme } from '@/theme/theme';

const ICONS = { info: 'info-outline', warning: 'warning-amber', success: 'check-circle-outline', promo: 'local-offer' } as const;

/** Boîte de réception des messages de l'équipe (nécessite une connexion). */
export default function NotificationsScreen() {
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<AppNotification[]>('/notifications'));
      setError(null);
    } catch (e) {
      setError(errorMessage(e, t('error.network'), t('error.generic')));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const color = (type: AppNotification['type']) => (type === 'warning' ? c.warning : type === 'success' ? c.success : type === 'promo' ? c.primary : c.textMuted);

  async function markRead(n: AppNotification) {
    if (n.read) return;
    setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? cur);
    api.patch(`/notifications/${n.id}/read`, {}).catch(() => {});
  }

  async function remove(n: AppNotification) {
    setItems((cur) => cur?.filter((x) => x.id !== n.id) ?? cur);
    api.delete(`/notifications/${n.id}`).catch(() => void load());
  }

  async function readAll() {
    setItems((cur) => cur?.map((x) => ({ ...x, read: true })) ?? cur);
    api.post('/notifications/read-all').catch(() => {});
  }

  const unread = items?.filter((n) => !n.read).length ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={c.primary} />}
    >
      {error ? <Card><Text variant="body" color={c.error}>{error}</Text></Card> : null}
      {items && items.length === 0 ? <EmptyState icon="notifications-none" title={t('notif.empty')} /> : null}
      {unread > 0 ? <Button title={t('notif.markAllRead')} variant="ghost" onPress={readAll} /> : null}
      {items?.map((n) => (
        <Pressable key={n.id} accessibilityRole="button" onPress={() => markRead(n)}>
          <Card style={{ flexDirection: 'row', gap: space.md, opacity: n.read ? 0.65 : 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: radius.md, backgroundColor: color(n.type) + '26', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={ICONS[n.type]} size={20} color={color(n.type)} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body">{n.title}</Text>
              <Text variant="label" muted style={{ fontWeight: '400' }}>{n.body}</Text>
              <Text variant="caption" muted>{new Date(n.created_at).toLocaleString(intl)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10} onPress={() => remove(n)}>
              <Icon name="close" size={18} color={c.textMuted} />
            </Pressable>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
