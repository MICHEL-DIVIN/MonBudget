import { router } from 'expo-router';
import { useRef, useState, type ComponentProps } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coin, Mascot } from '@/components/Mascot';
import { Guilloche } from '@/components/motion';
import { Button, haptic, space, Text } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const SLIDES: { key: string; pose: 'wave' | 'hold'; prop?: IconName; propColor?: string; coin?: boolean }[] = [
  { key: 'hello', pose: 'wave', coin: true },
  { key: 'left', pose: 'hold', prop: 'chart-donut', propColor: '#3FB98A' },
  { key: 'envelopes', pose: 'hold', prop: 'email-outline', propColor: '#E9874B' },
  { key: 'reminders', pose: 'hold', prop: 'bell-ring-outline', propColor: '#C89A3E' },
  { key: 'offline', pose: 'hold', prop: 'cloud-sync-outline', propColor: '#4F9BE0', coin: true },
];

/** Présentation de l'app avant la connexion : Sou, la mascotte, fait le tour en cinq écrans. */
export default function WelcomeScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const lastHaptic = useRef(0);
  const last = SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl, height: 48 }}>
        <Text variant="heading">Mon Budget</Text>
        {page < last ? (
          <Pressable accessibilityRole="button" onPress={() => goTo(last)} hitSlop={12}>
            <Text variant="label" muted>{t('welcome.skip')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const p = Math.round(e.nativeEvent.contentOffset.x / width);
          if (p !== lastHaptic.current) {
            haptic.select();
            lastHaptic.current = p;
          }
          setPage(p);
        }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <Slide key={s.key} index={i} x={x} width={width} slide={s} title={t(`welcome.${s.key}.title`)} body={t(`welcome.${s.key}.body`)} />
        ))}
      </Animated.ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: space.xl }}>
        {SLIDES.map((s, i) => <Dot key={s.key} index={i} x={x} width={width} />)}
      </View>

      <View style={{ paddingHorizontal: space.xl, gap: space.sm, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Button title={page === last ? t('welcome.start') : t('common.next')} onPress={() => (page === last ? router.push('/signup') : goTo(page + 1))} />
        <Button title={t('welcome.haveAccount')} variant="ghost" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}

function Slide({ index, x, width, slide, title, body }: { index: number; x: SharedValue<number>; width: number; slide: (typeof SLIDES)[number]; title: string; body: string }) {
  const { c } = useTheme();
  const { short, compact, tablet, gutter } = useLayout();
  const artH = tablet ? 340 : short ? 190 : 260;
  const mascot = tablet ? 1.4 : short || compact ? 0.8 : 1.05;
  // Parallaxe : la mascotte et le texte glissent à des vitesses différentes pendant le défilement.
  const art = useAnimatedStyle(() => {
    const p = (x.value - index * width) / width;
    return { transform: [{ translateX: p * width * 0.35 }, { scale: interpolate(Math.abs(p), [0, 1], [1, 0.8], 'clamp') }], opacity: interpolate(Math.abs(p), [0, 0.8], [1, 0], 'clamp') };
  });
  const text = useAnimatedStyle(() => {
    const p = (x.value - index * width) / width;
    return { transform: [{ translateX: p * width * 0.15 }], opacity: interpolate(Math.abs(p), [0, 0.6], [1, 0], 'clamp') };
  });
  return (
    <View style={{ width, flex: 1, paddingHorizontal: Math.max(gutter + 8, (width - 560) / 2), justifyContent: 'center', gap: short ? space.lg : space.xl }}>
      <Animated.View style={[{ height: artH, alignItems: 'center', justifyContent: 'center' }, art]}>
        <View style={{ position: 'absolute', left: -space.xl, right: -space.xl, top: 30 }}>
          <Guilloche width={width} height={200} color={c.guilloche} lines={12} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Mascot pose={slide.pose} prop={slide.prop} propColor={slide.propColor} size={mascot} />
          {slide.coin ? <View style={{ marginLeft: -30, marginBottom: 6 }}><Coin size={mascot * 0.7} delay={index * 120} /></View> : null}
        </View>
      </Animated.View>
      <Animated.View style={[{ gap: space.md }, text]}>
        <Text variant="display">{title}</Text>
        <Text variant="bodyRegular" muted style={{ fontSize: 16, lineHeight: 24 }}>{body}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, x, width }: { index: number; x: SharedValue<number>; width: number }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / width - index);
    return { width: interpolate(d, [0, 1], [28, 8], 'clamp'), opacity: interpolate(d, [0, 1], [1, 0.35], 'clamp') };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: c.primary }, style]} />;
}
