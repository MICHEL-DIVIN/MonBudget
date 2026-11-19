import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TourTarget } from '@/lib/tour/TourTarget';
import type { TourStepName } from '@/lib/tour/tourSteps';
import { useLayout } from '@/theme/layout';
import { motion, useTheme } from '@/theme/theme';
import { TAB_BAR_HEIGHT } from './Toast';
import { haptic, Text } from './ui';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Icône contour au repos, pleine quand l'onglet est actif. */
const ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-variant-outline', 'home-variant'],
  transactions: ['receipt-text-outline', 'receipt-text'],
  budget: ['wallet-outline', 'wallet'],
  analyse: ['chart-box-outline', 'chart-box'],
};

/** Onglets désignés par la visite guidée. */
const TOUR_STEP_BY_ROUTE: Record<string, TourStepName | undefined> = { transactions: 'activity', budget: 'budget' };

const MARGIN = 16;
const GAP = 10;
const PAD = 6;

/** Espace à réserver en bas des écrans d'onglets : la barre flotte au-dessus du contenu. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 12;
}

/**
 * Barre de navigation flottante : une capsule à quatre onglets (la pastille glisse vers l'onglet actif)
 * et, à côté, le bouton rond d'ajout d'opération.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW, tablet } = useLayout();
  const [width, setWidth] = useState(0);
  // Sur tablette, la barre ne s'étire pas sur toute la largeur.
  const side = tablet ? Math.max(MARGIN, (screenW - 520) / 2) : MARGIN;
  const tabW = width > 0 ? (width - PAD * 2) / state.routes.length : 0;

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(state.index * tabW, motion.settle) }] }), [state.index, tabW]);

  const shadow: ViewStyle = {
    shadowColor: '#000',
    shadowOpacity: scheme === 'dark' ? 0.45 : 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: side, right: side, bottom: Math.max(insets.bottom, 12), flexDirection: 'row', alignItems: 'center', gap: GAP }}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="tablist"
        style={[
          {
            flex: 1,
            height: TAB_BAR_HEIGHT,
            borderRadius: TAB_BAR_HEIGHT / 2,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.outlineVariant,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: PAD,
          },
          shadow,
        ]}
      >
        {tabW > 0 ? (
          <Animated.View
            style={[
              { position: 'absolute', left: PAD, top: PAD, bottom: PAD, width: tabW, borderRadius: (TAB_BAR_HEIGHT - PAD * 2) / 2, backgroundColor: c.primaryFixed },
              pill,
            ]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const label = (descriptors[route.key].options.title ?? route.name) as string;
          const tab = (
            <Tab
              label={label}
              icons={ICONS[route.name] ?? ['circle-outline', 'circle']}
              focused={focused}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic.select();
                  navigateToTab(route.key);
                }
              }}
            />
          );
          const step = TOUR_STEP_BY_ROUTE[route.name];
          return step ? (
            <TourTarget key={route.key} step={step} style={{ flex: 1 }}>
              {tab}
            </TourTarget>
          ) : (
            <View key={route.key} style={{ flex: 1 }}>
              {tab}
            </View>
          );
        })}
      </View>

      <TourTarget step="add">
        <AddButton shadow={shadow} />
      </TourTarget>
    </View>
  );
}

function Tab({ label, icons, focused, onPress }: { label: string; icons: [IconName, IconName]; focused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const iconStyle = useAnimatedStyle(
    () => ({ transform: [{ translateY: withSpring(focused ? -7 : 0, motion.settle) }, { scale: withSpring(focused ? 1.05 : 1, motion.press) }] }),
    [focused],
  );
  const labelStyle = useAnimatedStyle(
    () => ({ opacity: withSpring(focused ? 1 : 0, motion.settle), transform: [{ translateY: withSpring(focused ? 0 : 6, motion.settle) }] }),
    [focused],
  );
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={iconStyle}>
        <MaterialCommunityIcons name={focused ? icons[1] : icons[0]} size={25} color={focused ? c.primary : c.textMuted} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', bottom: 11 }, labelStyle]} pointerEvents="none">
        <Text variant="caption" color={c.text} style={{ fontSize: 11, lineHeight: 13 }} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function AddButton({ shadow }: { shadow: ViewStyle }) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const turn = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { rotate: `${turn.value}deg` }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une opération"
      onPressIn={() => {
        scale.value = withSpring(0.9, motion.press);
        turn.value = withSpring(90, motion.settle);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
        turn.value = withSpring(0, motion.settle);
      }}
      onPress={() => {
        haptic.light();
        router.push({ pathname: '/transaction', params: { type: 'expense' } });
      }}
    >
      <Animated.View
        style={[
          { width: TAB_BAR_HEIGHT, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
          shadow,
          style,
        ]}
      >
        <MaterialCommunityIcons name="plus" size={32} color={c.onPrimary} />
      </Animated.View>
    </Pressable>
  );
}
