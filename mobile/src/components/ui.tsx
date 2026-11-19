import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CONTENT_MAX_WIDTH, useLayout } from '@/theme/layout';
import { font, motion, useTheme } from '@/theme/theme';
import { Icon } from './Icon';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
/** Arrondis par niveau de hiérarchie : feuille > carte > contrôle > tuile. */
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 };

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

// --- Texte ---

type Variant = 'hero' | 'display' | 'title' | 'heading' | 'body' | 'bodyRegular' | 'label' | 'caption' | 'amount';

/** Échelle typographique (≈ quarte) : 13 · 15 · 16 · 20 · 26 · 34 · 52. */
const variants: Record<Variant, TextStyle> = {
  hero: { fontFamily: font.display, fontSize: 52, lineHeight: 58, letterSpacing: -1.5 },
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: font.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: font.displaySemi, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  amount: { fontFamily: font.displaySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  bodyRegular: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: font.semibold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: font.body, fontSize: 13, lineHeight: 17 },
};

const SCALED: Variant[] = ['hero', 'display', 'title'];

export function Text({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { c } = useTheme();
  const { typeScale } = useLayout();
  // Les polices personnalisées portent leur graisse : un fontWeight ferait retomber Android sur la police système.
  const { fontWeight: _ignored, ...flat } = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const base = variants[variant];
  // Grands titres et montants suivent la taille de l'écran ; le texte courant garde sa taille (lisibilité).
  const sized = SCALED.includes(variant) && typeScale !== 1 ? { fontSize: Math.round(base.fontSize! * typeScale), lineHeight: Math.round(base.lineHeight! * typeScale) } : null;
  return (
    <RNText
      // Le zoom de texte d'accessibilité est respecté, mais plafonné pour ne pas casser la mise en page.
      maxFontSizeMultiplier={SCALED.includes(variant) ? 1.2 : 1.6}
      {...rest}
      style={[base, sized, { color: color ?? (muted ? c.textMuted : c.text) }, flat]}
    />
  );
}

/** Style de la colonne de contenu : marges adaptées, centrée et bornée sur tablette. */
export function useContentStyle(): ViewStyle {
  const { gutter } = useLayout();
  return { paddingHorizontal: gutter, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' };
}

// --- Pression avec ressort ---

const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'marginStart', 'marginEnd', 'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

/** Sépare le style : mise en page (pour le parent) d'un côté, habillage (fond, bordures, padding…) de l'autre. */
function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(StyleSheet.flatten(style) ?? {})) (LAYOUT_KEYS.has(k) ? outer : inner)[k] = v;
  return [outer as ViewStyle, inner as ViewStyle];
}

export function PressableScale({ children, style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const [outer, inner] = splitStyle(style);
  return (
    <Pressable
      {...rest}
      style={outer}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, motion.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, motion.press);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[{ flexGrow: 1 }, inner, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

// --- Écran ---

export function Screen({
  children,
  scroll = true,
  padded = true,
  footer,
  contentStyle,
  keyboard,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const column = useContentStyle();
  const pad = padded ? column : { width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const };
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[pad, { paddingTop: padded ? space.lg : 0, paddingBottom: space.xxl + (footer ? 0 : insets.bottom), gap: space.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, pad, padded && { paddingVertical: space.lg }, contentStyle]}>{children}</View>
  );
  const content = (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {body}
      {footer ? (
        <View style={{ paddingTop: space.md, paddingBottom: space.md + insets.bottom, backgroundColor: c.background }}>
          <View style={column}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
  return keyboard ? (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );
}

// --- Surfaces ---

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg };
  if (onPress) {
    return (
      <PressableScale accessibilityRole="button" onPress={onPress} style={[base, style]} scaleTo={0.98}>
        {children}
      </PressableScale>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/** Tuile d'icône teintée (catégories, enveloppes). */
export function IconTile({ icon, color, size = 42 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

// --- Boutons ---

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  size = 'lg',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'lg' | 'md';
}) {
  const { c } = useTheme();
  const palette = {
    primary: { bg: c.primary, fg: c.onPrimary },
    secondary: { bg: c.cardHigh, fg: c.text },
    danger: { bg: c.errorContainer, fg: c.error },
    ghost: { bg: 'transparent', fg: c.primary },
  }[variant];
  const off = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={
        off
          ? undefined
          : () => {
              if (variant === 'primary') haptic.light();
              onPress();
            }
      }
      style={[
        {
          backgroundColor: palette.bg,
          borderRadius: radius.md,
          minHeight: size === 'lg' ? 54 : 44,
          paddingHorizontal: space.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: off ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Icon name={icon} size={20} color={palette.fg} /> : null}
      <Text variant="label" color={palette.fg} style={{ fontSize: size === 'lg' ? 16 : 14 }}>
        {title}
      </Text>
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, color, size = 24, filled }: { icon: string; onPress: () => void; label: string; color?: string; size?: number; filled?: boolean }) {
  const { c } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={10}
      scaleTo={0.88}
      style={{ width: size + 18, height: size + 18, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.cardHigh : 'transparent' }}
    >
      <Icon name={icon} size={size} color={color ?? c.text} />
    </PressableScale>
  );
}

// --- Saisie ---

export function Field({ label, error, hint, right, ...input }: TextInputProps & { label: string; error?: string | null; hint?: string; right?: ReactNode }) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" muted>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: c.cardHigh,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? c.error : focused ? c.primary : 'transparent',
          paddingHorizontal: space.lg,
        }}
      >
        <TextInput
          placeholderTextColor={c.textMuted}
          accessibilityLabel={label}
          selectionColor={c.primary}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[{ flex: 1, color: c.text, fontSize: 16, fontFamily: font.medium, paddingVertical: 14 }, input.style]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color={c.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Choix exclusif : la pastille glisse vers l'option choisie. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 6) / options.length : 0;
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * segment, motion.settle) }] }), [index, segment]);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', backgroundColor: c.cardHigh, borderRadius: radius.md, padding: 3 }}
      accessibilityRole="tablist"
    >
      {segment > 0 ? (
        <Animated.View style={[{ position: 'absolute', top: 3, left: 3, bottom: 3, width: segment, borderRadius: radius.md - 3, backgroundColor: c.card }, pill]} />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (!active) haptic.select();
              onChange(o.value);
            }}
            style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text variant="label" color={active ? c.text : c.textMuted}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, color, icon }: { label: string; active?: boolean; onPress: () => void; color?: string; icon?: string }) {
  const { c } = useTheme();
  const tint = color ?? c.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      scaleTo={0.94}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radius.full,
        backgroundColor: active ? tint + '2E' : c.cardHigh,
        borderWidth: 1.5,
        borderColor: active ? tint : 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={16} color={active ? tint : c.textMuted} /> : null}
      <Text variant="label" color={active ? c.text : c.textMuted}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.sm }}>
      <Text variant="heading">{children}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text variant="label" color={c.primary}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: string; title: string; hint?: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: c.primaryFixed, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm }}>
        <Icon name={icon} size={32} color={c.primary} />
      </View>
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {hint ? (
        <Text variant="bodyRegular" muted style={{ textAlign: 'center', maxWidth: 290 }}>
          {hint}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function Row({ icon, iconColor, title, subtitle, right, onPress, danger }: { icon?: string; iconColor?: string; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; danger?: boolean }) {
  const { c } = useTheme();
  const tint = danger ? c.error : (iconColor ?? c.primary);
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
      {icon ? <IconTile icon={icon} color={tint} size={36} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={danger ? c.error : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" muted>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={22} color={c.textMuted} /> : null)}
    </View>
  );
  return onPress ? (
    <PressableScale accessibilityRole="button" onPress={onPress} scaleTo={0.98}>
      {content}
    </PressableScale>
  ) : (
    content
  );
}
