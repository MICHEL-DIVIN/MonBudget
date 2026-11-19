import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useLayout } from '@/theme/layout';
import { motion, useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { haptic, PressableScale, radius, space, Text } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

function Dot({ filled }: { filled: boolean }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(filled ? 1 : 0.6, motion.press) }],
    backgroundColor: filled ? c.primary : c.outline,
  }));
  return <Animated.View style={[{ width: 16, height: 16, borderRadius: 8 }, style]} />;
}

/**
 * Clavier à 4 chiffres. `onComplete` renvoie un message d'erreur (le code est alors effacé, les points tremblent) ou null.
 */
export function PinPad({ title, subtitle, onComplete, disabled }: { title: string; subtitle?: string; onComplete: (pin: string) => Promise<string | null> | string | null; disabled?: boolean }) {
  const { c } = useTheme();
  const { short, compact } = useLayout();
  const key = short || compact ? 64 : 76;
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    setBusy(true);
    Promise.resolve(onComplete(pin)).then((err) => {
      if (cancelled) return;
      setBusy(false);
      if (err) {
        setError(err);
        setPin('');
        haptic.warn();
        shake.value = withSequence(withTiming(-12, { duration: 50 }), withTiming(12, { duration: 50 }), withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(0, { duration: 50 }));
      }
    });
    return () => {
      cancelled = true;
    };
    // onComplete exclu volontairement : on ne relance pas la vérification à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = (k: string) => {
    if (busy || disabled) return;
    haptic.select();
    setError(null);
    if (k === 'del') setPin((p) => p.slice(0, -1));
    else if (pin.length < 4) setPin((p) => p + k);
  };

  return (
    <View style={{ alignItems: 'center', gap: short ? space.lg : space.xl }}>
      <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: c.primaryFixed, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-outline" size={28} color={c.primary} />
      </View>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
        {subtitle ? <Text variant="bodyRegular" muted style={{ textAlign: 'center' }}>{subtitle}</Text> : null}
      </View>

      <Animated.View style={[{ flexDirection: 'row', gap: space.lg }, shakeStyle]} accessibilityLabel={`${pin.length}/4`}>
        {[0, 1, 2, 3].map((i) => <Dot key={i} filled={i < pin.length} />)}
      </Animated.View>

      <Text variant="label" color={c.error} style={{ minHeight: 19 }} accessibilityLiveRegion="polite">{error ?? ' '}</Text>

      <View style={{ width: key * 3 + space.lg * 2 + 4, flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, justifyContent: 'center' }}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} style={{ width: key, height: key }} />
          ) : (
            <PressableScale
              key={i}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Effacer' : k}
              onPress={() => press(k)}
              scaleTo={0.9}
              style={{ width: key, height: key, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'del' ? 'transparent' : c.card }}
            >
              {k === 'del' ? <Icon name="backspace" size={26} color={c.textMuted} /> : <Text variant="display">{k}</Text>}
            </PressableScale>
          ),
        )}
      </View>
    </View>
  );
}
