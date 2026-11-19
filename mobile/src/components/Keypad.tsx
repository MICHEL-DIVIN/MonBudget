import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useLayout } from '@/theme/layout';
import { motion, useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { haptic, PressableScale, radius, Text } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const;

/** Affichage du montant saisi : « rebondit » à chaque chiffre, tremble si la saisie est refusée. */
export function AmountDisplay({ value, symbol, color, shakeKey = 0 }: { value: string; symbol: string; color: string; shakeKey?: number }) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(withTiming(1.04, { duration: 70 }), withSpring(1, motion.press));
  }, [value, scale]);
  useEffect(() => {
    if (shakeKey > 0) shake.value = withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 50 }), withTiming(-5, { duration: 50 }), withTiming(0, { duration: 50 }));
  }, [shakeKey, shake]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { translateX: shake.value }] }));
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }, style]} accessibilityLiveRegion="polite">
      <Text variant="hero" color={value ? color : c.textMuted} style={{ fontVariant: ['tabular-nums'] }} adjustsFontSizeToFit numberOfLines={1}>
        {value || '0'}
      </Text>
      <Text variant="title" muted>{symbol}</Text>
    </Animated.View>
  );
}

export function Keypad({ onKey, decimals = 2 }: { onKey: (k: string) => void; decimals?: number }) {
  const { c } = useTheme();
  const { short, compact, tablet } = useLayout();
  const keyH = tablet ? 60 : short || compact ? 44 : 54;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: short ? 6 : 8 }}>
      {KEYS.map((k) => {
        const disabled = k === ',' && decimals === 0;
        return (
          <View key={k} style={{ width: '33.33%', paddingHorizontal: 4 }}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Effacer' : k === ',' ? 'Virgule' : k}
              disabled={disabled}
              onPress={() => {
                haptic.select();
                onKey(k);
              }}
              onLongPress={k === 'del' ? () => onKey('clear') : undefined}
              scaleTo={0.92}
              style={{ height: keyH, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'del' ? 'transparent' : c.card, opacity: disabled ? 0.3 : 1 }}
            >
              {k === 'del' ? <Icon name="backspace" size={24} color={c.textMuted} /> : <Text variant="title">{k}</Text>}
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}
