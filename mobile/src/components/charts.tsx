import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { font, motion, useTheme } from '@/theme/theme';
import { Text } from './ui';

const ease = Easing.out(Easing.cubic);

/** Jauge linéaire : se remplit (ou se vide) jusqu'à la nouvelle valeur. Au-delà de 100 %, elle reste pleine. */
export function ProgressBar({ value, color, height = 8, track }: { value: number; color: string; height?: number; track?: string }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(100, value));
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(pct / 100, { duration: motion.fill, easing: ease });
  }, [pct, fill]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? c.cardHighest, overflow: 'hidden' }}
    >
      <Animated.View style={[{ height, width: '100%', borderRadius: height, backgroundColor: color, transformOrigin: 'left' }, style]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anneau de progression (enveloppes, objectifs). */
export function Ring({ value, color, size = 56, thickness = 6, children, track }: { value: number; color: string; size?: number; thickness?: number; children?: React.ReactNode; track?: string }) {
  const { c } = useTheme();
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, value / 100)), { duration: motion.fill, easing: ease });
  }, [value, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.cardHighest} strokeWidth={thickness} fill="none" />
          <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} animatedProps={props} />
        </G>
      </Svg>
      {children}
    </View>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** Anneau de répartition (catégories) : chaque part apparaît à la suite. */
export function Donut({ slices, size = 160, thickness = 18, children }: { slices: Slice[]; size?: number; thickness?: number; children?: React.ReactNode }) {
  const { c } = useTheme();
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 4 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.cardHigh} strokeWidth={thickness} fill="none" />
          {total > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s, i) => {
                const len = Math.max(0, (s.value / total) * circ - gap);
                const el = <DonutArc key={s.label} r={r} size={size} thickness={thickness} color={s.color} len={len} circ={circ} start={offset} index={i} />;
                offset += (s.value / total) * circ;
                return el;
              })}
        </G>
      </Svg>
      {children}
    </View>
  );
}

function DonutArc({ r, size, thickness, color, len, circ, start, index }: { r: number; size: number; thickness: number; color: string; len: number; circ: number; start: number; index: number }) {
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(index * 90, withTiming(len, { duration: 600, easing: ease }));
  }, [len, index, shown]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [shown.value, circ] }));
  return <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeDashoffset={-start} animatedProps={props} />;
}

export interface BarDatum {
  label: string;
  a: number;
  b: number;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

function Bar({ x, base, h, w, color, delay }: { x: number; base: number; h: number; w: number; color: string; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(delay, withTiming(h, { duration: 550, easing: ease }));
  }, [h, delay, grow]);
  const props = useAnimatedProps(() => ({ y: base - grow.value, height: grow.value }));
  return <AnimatedRect x={x} width={w} rx={Math.min(3, w / 2)} fill={color} animatedProps={props} />;
}

/** Barres groupées (entrées / sorties par mois). Le mois sélectionné est mis en avant. */
export function BarChart({ data, width, height = 160, colorA, colorB, highlight }: { data: BarDatum[]; width: number; height?: number; colorA: string; colorB: string; highlight?: number }) {
  const { c } = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const base = height - 20;
  const slot = width / data.length;
  const w = Math.max(3, Math.min(10, slot / 3.2));
  return (
    <Svg width={width} height={height}>
      <Line x1={0} y1={base} x2={width} y2={base} stroke={c.outlineVariant} strokeWidth={1} />
      {data.map((d, i) => {
        const x = i * slot + slot / 2;
        const dim = highlight !== undefined && highlight !== i;
        return (
          <G key={d.label + i} opacity={dim ? 0.45 : 1}>
            <Bar x={x - w - 1} base={base} h={(d.a / max) * (base - 6)} w={w} color={colorA} delay={i * 25} />
            <Bar x={x + 1} base={base} h={(d.b / max) * (base - 6)} w={w} color={colorB} delay={i * 25 + 40} />
            <SvgText x={x} y={height - 4} fontSize={10} fontFamily={font.medium} fill={highlight === i ? c.text : c.textMuted} textAnchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export interface TrendPoint {
  label: string;
  value: number;
}

const AnimatedLinePath = Animated.createAnimatedComponent(Path);

/** Courbe (solde mensuel, épargne cumulée) qui se trace de gauche à droite. Gère les valeurs négatives. */
export function TrendChart({ data, width, height = 110, color }: { data: TrendPoint[]; width: number; height?: number; color: string }) {
  const { c } = useTheme();
  const draw = useSharedValue(0);
  const key = data.map((d) => d.value).join(',');
  useEffect(() => {
    draw.value = 0;
    draw.value = withTiming(1, { duration: 900, easing: ease });
  }, [key, draw]);

  const pad = 8;
  const labelH = 18;
  const h = height - labelH;
  const min = Math.min(0, ...data.map((d) => d.value));
  const max = Math.max(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const zero = y(0);
  const length = width * 1.6;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.value) }));
  if (data.length < 2) return null;
  const area = `${line} L${x(data.length - 1).toFixed(1)},${zero.toFixed(1)} L${x(0).toFixed(1)},${zero.toFixed(1)} Z`;

  return (
    <Svg width={width} height={height}>
      <Line x1={pad} y1={zero} x2={width - pad} y2={zero} stroke={c.outline} strokeWidth={1} strokeDasharray="2,4" />
      <Path d={area} fill={color} opacity={0.1} />
      <AnimatedLinePath d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={lineProps} />
      <Circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r={4} fill={color} />
      {data.map((d, i) => (
        <SvgText key={d.label + i} x={x(i)} y={height - 3} fontSize={10} fontFamily={font.medium} fill={i === data.length - 1 ? c.text : c.textMuted} textAnchor="middle">
          {d.label}
        </SvgText>
      ))}
    </Svg>
  );
}

/** Légende simple. */
export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}
