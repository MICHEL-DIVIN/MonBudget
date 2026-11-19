import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, type ComponentProps } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * « Sou », la mascotte : un billet de banque qui présente l'app.
 * Dessiné en SVG et animé avec Reanimated (aucun fichier d'animation externe).
 * Toujours aux couleurs laiton / encre, quel que soit le thème, pour rester reconnaissable.
 */

const BODY = '#E2B356';
const BODY_DARK = '#C89A3E';
const INK = '#1A2233';
const CHEEK = '#E7837A';
const COIN = '#4CC795';
const COIN_DARK = '#35A87A';

const W = 210;
const H = 220;

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function useLoop(enabled: boolean, build: () => void, cleanup: () => void, deps: unknown[]) {
  useEffect(() => {
    if (!enabled) return;
    build();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}

/** Le billet. `pose="wave"` : il salue ; `pose="hold"` : il brandit un objet (icône). */
export function Mascot({ pose = 'wave', prop, propColor = '#4F9BE0', size = 1 }: { pose?: 'wave' | 'hold'; prop?: IconName; propColor?: string; size?: number }) {
  const reduce = useReducedMotion();
  const float = useSharedValue(0);
  const blink = useSharedValue(1);
  const arm = useSharedValue(pose === 'wave' ? 0 : -10);
  const wiggle = useSharedValue(0);
  const enter = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    enter.value = withSpring(1, { damping: 12, stiffness: 140 });
  }, [enter]);

  useLoop(
    !reduce,
    () => {
      // Flotte doucement…
      float.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
      // …cligne des yeux de temps en temps…
      blink.value = withRepeat(withSequence(withDelay(2600, withTiming(0.08, { duration: 90 })), withTiming(1, { duration: 130 })), -1, false);
      // …salue ou agite son objet.
      arm.value =
        pose === 'wave'
          ? withRepeat(withSequence(withTiming(-28, { duration: 260 }), withTiming(14, { duration: 260 }), withTiming(-28, { duration: 260 }), withTiming(0, { duration: 300 }), withDelay(1400, withTiming(0, { duration: 1 }))), -1, false)
          : withRepeat(withSequence(withTiming(-16, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(-6, { duration: 700, easing: Easing.inOut(Easing.sin) })), -1, true);
      wiggle.value = withRepeat(withSequence(withTiming(-7, { duration: 420 }), withTiming(7, { duration: 420 })), -1, true);
    },
    () => {
      cancelAnimation(float);
      cancelAnimation(blink);
      cancelAnimation(arm);
      cancelAnimation(wiggle);
    },
    [pose],
  );

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * float.value }, { scale: enter.value }] }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 - 0.18 * float.value }], opacity: 0.22 - 0.08 * float.value }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const armStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${arm.value}deg` }] }));
  const propStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value}deg` }, { translateY: -3 * float.value }] }));

  const raised = pose === 'hold' || pose === 'wave';

  return (
    <View style={{ width: W * size, height: H * size }} accessible accessibilityRole="image" accessibilityLabel="Sou, la mascotte de Mon Budget">
      <View style={{ width: W, height: H, transform: [{ scale: size }], transformOrigin: 'top left' }}>
        {/* Ombre au sol : se resserre quand Sou s'élève. */}
        <Animated.View style={[{ position: 'absolute', left: 58, top: 196, width: 84, height: 12, borderRadius: 6, backgroundColor: '#000' }, shadowStyle]} />

        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: W, height: H }, bodyStyle]}>
          <Svg width={W} height={H} style={{ position: 'absolute' }}>
            {/* Bras gauche (au repos) */}
            <Path d="M54 98 Q36 112 32 128" stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
            <Circle cx={31} cy={131} r={7} fill={BODY} stroke={INK} strokeWidth={3} />
            {/* Jambes */}
            <Path d="M84 154 L81 178" stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <Path d="M116 154 L119 178" stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <Ellipse cx={76} cy={182} rx={10} ry={5} fill={INK} />
            <Ellipse cx={124} cy={182} rx={10} ry={5} fill={INK} />
            {/* Corps : un billet, avec son cadre et sa rosace */}
            <Rect x={50} y={24} width={100} height={132} rx={18} fill={BODY} stroke={INK} strokeWidth={3.5} />
            <Rect x={59} y={33} width={82} height={114} rx={12} fill="none" stroke={BODY_DARK} strokeWidth={2} />
            <Circle cx={100} cy={128} r={12} fill="none" stroke={BODY_DARK} strokeWidth={2} />
            <Circle cx={100} cy={128} r={6} fill="none" stroke={BODY_DARK} strokeWidth={2} />
            <Path d="M88 128 Q94 120 100 128 Q106 136 112 128" fill="none" stroke={BODY_DARK} strokeWidth={1.5} />
            {/* Joues + sourire */}
            <Circle cx={72} cy={98} r={7} fill={CHEEK} opacity={0.45} />
            <Circle cx={128} cy={98} r={7} fill={CHEEK} opacity={0.45} />
            <Path d="M88 98 Q100 112 112 98" stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
          </Svg>

          {/* Yeux (clignent) */}
          {[80, 120].map((cx) => (
            <Animated.View key={cx} style={[{ position: 'absolute', left: cx - 9, top: 66, width: 18, height: 22, borderRadius: 9, backgroundColor: '#fff', borderWidth: 2.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' }, eyeStyle]}>
              <View style={{ width: 8, height: 9, borderRadius: 4.5, backgroundColor: INK, marginTop: 3 }} />
            </Animated.View>
          ))}

          {/* Bras droit : salue ou tient l'objet (pivote à l'épaule) */}
          <Animated.View style={[{ position: 'absolute', left: 146, top: 54, width: 46, height: 46, transformOrigin: '0% 100%' }, armStyle]}>
            <Svg width={46} height={46}>
              <Path d={raised ? 'M2 44 Q18 30 32 10' : 'M2 44 Q18 50 30 60'} stroke={INK} strokeWidth={5} strokeLinecap="round" fill="none" />
              <Circle cx={33} cy={9} r={7} fill={BODY} stroke={INK} strokeWidth={3} />
            </Svg>
          </Animated.View>

          {pose === 'hold' && prop ? (
            <Animated.View
              style={[
                { position: 'absolute', left: 156, top: 2, width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
                propStyle,
              ]}
            >
              <MaterialCommunityIcons name={prop} size={28} color={propColor} />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

/** La pièce, compagne de Sou : elle rebondit (écrasement à l'atterrissage). */
export function Coin({ size = 1, delay = 0 }: { size?: number; delay?: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  const squash = useSharedValue(1);
  const blink = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-26, { duration: 380, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 340, easing: Easing.in(Easing.quad) }), withDelay(500, withTiming(0, { duration: 1 }))), -1, false));
    // Même période que le saut (1 220 ms) : l'écrasement tombe pile à l'atterrissage, sans dériver.
    squash.value = withDelay(delay, withRepeat(withSequence(withDelay(720, withTiming(0.8, { duration: 60 })), withTiming(1, { duration: 140 }), withDelay(299, withTiming(1, { duration: 1 }))), -1, false));
    blink.value = withRepeat(withSequence(withDelay(3400, withTiming(0.1, { duration: 90 })), withTiming(1, { duration: 120 })), -1, false);
    return () => {
      cancelAnimation(y);
      cancelAnimation(squash);
      cancelAnimation(blink);
    };
  }, [y, squash, blink, delay, reduce]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }] }));
  const eyes = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  const s = 64 * size;

  return (
    <View style={{ width: s, height: s + 30 * size, justifyContent: 'flex-end', alignItems: 'center' }} accessible={false}>
      <Animated.View style={[{ width: s, height: s, transformOrigin: '50% 100%' }, style]}>
        <Svg width={s} height={s} viewBox="0 0 64 64">
          <Circle cx={32} cy={32} r={29} fill={COIN} stroke={INK} strokeWidth={3} />
          <Circle cx={32} cy={32} r={21} fill="none" stroke={COIN_DARK} strokeWidth={2.5} />
          <Path d="M24 40 Q32 47 40 40" stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
        </Svg>
        <Animated.View style={[{ position: 'absolute', top: s * 0.36, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: s * 0.18 }, eyes]}>
          <View style={{ width: s * 0.09, height: s * 0.12, borderRadius: s, backgroundColor: INK }} />
          <View style={{ width: s * 0.09, height: s * 0.12, borderRadius: s, backgroundColor: INK }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
