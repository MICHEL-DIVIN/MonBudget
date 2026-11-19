import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { formatLocalDate, toLocalDate } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { gridColumns, useLayout } from '@/theme/layout';
import { motion, useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { haptic, PressableScale, radius, space, Text } from './ui';

// --- Grille de tuiles (enveloppes, types de revenu) ---

export interface TileOption {
  key: string;
  label: string;
  icon: string;
  color: string;
}

function Tile({ option, selected, onPress, basis }: { option: TileOption; selected: boolean; onPress: () => void; basis: `${number}%` }) {
  const { c } = useTheme();
  const badge = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(selected ? 1 : 0, motion.press) }] }), [selected]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(selected ? 1.06 : 1, motion.press) }] }), [selected]);
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.label}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      scaleTo={0.9}
      style={{ width: basis, alignItems: 'center', gap: 6, paddingVertical: space.xs }}
    >
      <Animated.View
        style={[
          { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? option.color : option.color + '22', borderWidth: 2, borderColor: selected ? option.color : 'transparent' },
          ring,
        ]}
      >
        <Icon name={option.icon} size={26} color={selected ? '#fff' : option.color} />
        <Animated.View style={[{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.background }, badge]}>
          <Icon name="check" size={12} color={c.background} />
        </Animated.View>
      </Animated.View>
      <Text variant="caption" color={selected ? c.text : c.textMuted} numberOfLines={1} style={{ maxWidth: 76, textAlign: 'center' }}>
        {option.label}
      </Text>
    </PressableScale>
  );
}

/** Choix visuel en grille de 4 colonnes : on reconnaît l'icône avant de lire le nom. */
export function TileGrid({ options, value, onChange }: { options: TileOption[]; value: string | null; onChange: (key: string) => void }) {
  const { contentWidth, gutter } = useLayout();
  const cols = gridColumns(contentWidth - gutter * 2);
  const basis = `${100 / cols}%` as const;
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs }}>
      {options.map((o) => (
        <Tile key={o.key} option={o} basis={basis} selected={value === o.key} onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

// --- Bandeau de jours ---

/** Les 30 derniers jours en un défilement horizontal (aujourd'hui à droite), plus un calendrier pour le reste. */
export function DateStrip({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const { c, scheme } = useTheme();
  const { t, intl } = useI18n();
  const scroll = useRef<ScrollViewInstance>(null);
  const [iosPicker, setIosPicker] = useState(false);

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      return { key: formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate()), d, isToday: i === 29 };
    });
  }, []);
  const inStrip = days.some((d) => d.key === value);

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 50);
    return () => clearTimeout(id);
  }, []);

  const pick = (d?: Date) => {
    if (d) onChange(formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate()));
  };
  const openCalendar = () => {
    haptic.select();
    if (Platform.OS === 'android') DateTimePickerAndroid.open({ value: toLocalDate(value), mode: 'date', onChange: (_e, d) => pick(d) });
    else setIosPicker((o) => !o);
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
          {days.map(({ key, d, isToday }) => {
            const selected = key === value;
            return (
              <PressableScale
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={d.toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'long' })}
                onPress={() => {
                  haptic.select();
                  onChange(key);
                }}
                scaleTo={0.9}
                style={{ width: 50, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center', gap: 2, backgroundColor: selected ? c.primary : c.card }}
              >
                <Text variant="caption" color={selected ? c.onPrimary : c.textMuted} style={{ fontSize: 11 }}>
                  {isToday ? t('common.todayShort') : d.toLocaleDateString(intl, { weekday: 'short' }).replace('.', '')}
                </Text>
                <Text variant="heading" color={selected ? c.onPrimary : c.text} style={{ fontSize: 18, lineHeight: 22 }}>
                  {d.getDate()}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('tx.otherDate')}
          onPress={openCalendar}
          scaleTo={0.9}
          style={{ width: 50, alignSelf: 'stretch', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: !inStrip ? c.primary : c.card }}
        >
          <Icon name="calendar-month" size={22} color={!inStrip ? c.onPrimary : c.text} />
        </PressableScale>
      </View>
      {!inStrip ? (
        <Text variant="caption" color={c.primary}>{toLocalDate(value).toLocaleDateString(intl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      ) : null}
      {Platform.OS === 'ios' && iosPicker ? <DateTimePicker value={toLocalDate(value)} mode="date" display="inline" themeVariant={scheme} onChange={(_e, d) => pick(d)} /> : null}
    </View>
  );
}

// --- Cartes d'option (fixe / variable…) ---

export function OptionCards<T extends string>({ options, value, onChange }: { options: { value: T; title: string; hint: string; icon: string }[]; value: T; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space.sm }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              haptic.select();
              onChange(o.value);
            }}
            scaleTo={0.96}
            style={{ flex: 1, padding: space.md, gap: 6, borderRadius: radius.md, backgroundColor: selected ? c.primaryFixed : c.card, borderWidth: 1.5, borderColor: selected ? c.primary : 'transparent' }}
          >
            <Icon name={o.icon} size={22} color={selected ? c.primary : c.textMuted} />
            <Text variant="label">{o.title}</Text>
            <Text variant="caption" muted>{o.hint}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
