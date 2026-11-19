import { useEffect, useMemo, useRef, useState } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Text } from './ui';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Montant qui défile de l'ancienne à la nouvelle valeur quand les données changent :
 * on voit ce qui a bougé. Instantané si l'utilisateur a demandé moins d'animations.
 */
export function AnimatedAmount({
  value,
  format,
  variant = 'hero',
  color,
  style,
  duration = 650,
}: {
  value: number;
  format: (n: number) => string;
  variant?: 'hero' | 'display' | 'title' | 'heading' | 'amount' | 'label';
  color?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const v = start + (value - start) * easeOut(p);
      setShown(v);
      from.current = v;
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, reduce]);

  return (
    <Text variant={variant} color={color} style={[{ fontVariant: ['tabular-nums'] }, style]} accessibilityLabel={format(value)} adjustsFontSizeToFit numberOfLines={1}>
      {format(shown)}
    </Text>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Une ligne de guilloché, tracée sur DEUX largeurs et périodique : en la faisant glisser
 * d'une largeur, la boucle est parfaite (aucun raccord visible).
 */
function guillochePath(width: number, height: number, i: number, count: number): string {
  const mid = height / 2;
  const amp = height * 0.34;
  const phase = (i / count) * Math.PI * 2;
  const steps = 128;
  let d = '';
  for (let s = 0; s <= steps; s++) {
    const x = (s / steps) * width * 2;
    const t = (s / steps) * Math.PI * 4; // 2 périodes de 2π sur 2 largeurs
    const y = mid + amp * Math.sin(t * 2 + phase) * Math.cos(t - phase / 2) + (i - count / 2) * 1.3;
    d += `${s === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return d;
}

function GuillocheLine({ d, color, delay, length }: { d: string; color: string; delay: number; length: number }) {
  const reduce = useReducedMotion();
  const offset = useSharedValue(reduce ? 0 : length);
  useEffect(() => {
    if (reduce) return;
    offset.value = withDelay(delay, withTiming(0, { duration: 1600, easing: Easing.out(Easing.cubic) }));
  }, [offset, delay, reduce]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return <AnimatedPath d={d} stroke={color} strokeWidth={1} fill="none" strokeDasharray={`${length} ${length}`} animatedProps={props} />;
}

/** Une nappe de lignes qui dérive en continu (vers la gauche ou la droite). */
function GuillocheLayer({ paths, width, height, color, direction, duration, delayBase }: { paths: string[]; width: number; height: number; color: string; direction: 1 | -1; duration: number; delayBase: number }) {
  const reduce = useReducedMotion();
  const x = useSharedValue(direction === 1 ? -width : 0);
  useEffect(() => {
    if (reduce || width <= 0) return;
    x.value = direction === 1 ? -width : 0;
    x.value = withRepeat(withTiming(direction === 1 ? 0 : -width, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(x);
  }, [x, width, direction, duration, reduce]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const length = width * 4.6;
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: width * 2, height }, style]} pointerEvents="none">
      <Svg width={width * 2} height={height} accessible={false}>
        {paths.map((d, i) => (
          <GuillocheLine key={i} d={d} color={color} delay={delayBase + i * 50} length={length} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/**
 * Motif guilloché vivant (signature de l'app) : il se trace à l'ouverture puis dérive en continu,
 * deux nappes en sens opposés comme les fonds de sécurité des billets. Immobile si « réduire les animations » est activé.
 */
export function Guilloche({ width, height, color, lines = 14 }: { width: number; height: number; color: string; lines?: number }) {
  const paths = useMemo(() => Array.from({ length: lines }, (_, i) => guillochePath(width, height, i, lines)), [width, height, lines]);
  if (width <= 0) return null;
  const even = paths.filter((_, i) => i % 2 === 0);
  const odd = paths.filter((_, i) => i % 2 === 1);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }} pointerEvents="none">
      <GuillocheLayer paths={even} width={width} height={height} color={color} direction={-1} duration={22000} delayBase={0} />
      <GuillocheLayer paths={odd} width={width} height={height} color={color} direction={1} duration={34000} delayBase={25} />
    </View>
  );
}
