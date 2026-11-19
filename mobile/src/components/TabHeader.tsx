import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TourTarget } from '@/lib/tour/TourTarget';
import { useI18n } from '@/lib/i18n';
import { useSyncStatus } from '@/lib/sync';
import type { AppNotification } from '@/lib/types';
import { useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { PressableScale, space, Text, useContentStyle } from './ui';

/** Icône de synchronisation : tourne pendant l'envoi, change d'état hors ligne / en erreur. */
function SyncIndicator() {
  const { c } = useTheme();
  const { t } = useI18n();
  const sync = useSyncStatus();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (sync.state === 'syncing') {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(spin);
      spin.value = withTiming(0, { duration: 200 });
    }
  }, [sync.state, spin]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 360}deg` }] }));

  if (sync.state === 'idle' && sync.pending === 0) return null; // tout est à jour : rien à signaler
  const icon = sync.state === 'offline' ? 'cloud-off' : sync.state === 'error' ? 'sync-problem' : 'sync';
  const color = sync.state === 'error' ? c.error : sync.state === 'offline' ? c.warning : c.textMuted;
  const label = sync.state === 'offline' ? t('sync.offlineShort') : sync.state === 'error' ? t('sync.error') : t('sync.syncing');
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Animated.View style={style}>
        <Icon name={icon} size={18} color={color} />
      </Animated.View>
      {sync.state === 'offline' ? <Text variant="caption" color={color}>{t('sync.offlineShort')}</Text> : null}
    </View>
  );
}

let unreadCache = 0;

function useUnreadCount(): number {
  const [n, setN] = useState(unreadCache);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api
        .get<AppNotification[]>('/notifications')
        .then((list) => {
          unreadCache = list.filter((x) => !x.read).length;
          if (alive) setN(unreadCache);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  return n;
}

/** En-tête des onglets : titre à gauche, état + notifications + profil à droite. */
export function TabHeader({ title, subtitle, children, tourAvatar = false }: { title: string; subtitle?: string; children?: ReactNode; /** Cet en-tête porte l'étape « Réglages » de la visite guidée (un seul à la fois). */ tourAvatar?: boolean }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  const column = useContentStyle();
  const initial = (user?.full_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[column, { paddingTop: insets.top + space.sm, paddingBottom: space.sm, gap: space.md }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          {subtitle ? <Text variant="caption" muted>{subtitle}</Text> : null}
          <Text variant="title" numberOfLines={1}>{title}</Text>
        </View>
        <SyncIndicator />
        <PressableScale accessibilityRole="button" accessibilityLabel={unread ? t('notif.unread', { n: unread }) : t('notif.title')} onPress={() => router.push('/notifications')} scaleTo={0.88} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="notifications-none" size={22} color={c.text} />
          {unread > 0 ? (
            <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: c.error, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.card }}>
              <Text variant="caption" color="#fff" style={{ fontSize: 9, lineHeight: 11 }}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </PressableScale>
        <TourTarget step="settings" active={tourAvatar}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('nav.settings')} onPress={() => router.push('/settings')} scaleTo={0.88} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryFixed, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={{ width: 40, height: 40 }} /> : <Text variant="label" color={c.primary}>{initial}</Text>}
        </PressableScale>
        </TourTarget>
      </View>
      {children}
    </View>
  );
}
