import { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, useAnimatedStyle, interpolate, type SharedValue } from 'react-native-reanimated';
import { useLayout } from '@/theme/layout';
import { envelopeColor, useTheme } from '@/theme/theme';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import { monthName } from '@/lib/format';
import { Icon } from './Icon';
import { ProgressBar, Ring } from './charts';
import { haptic, IconButton, IconTile, PressableScale, radius, space, Text } from './ui';

// --- Sélecteur de mois ---

export function MonthSelector({ month, year, onChange }: { month: number; year: number; onChange: (month: number, year: number) => void }) {
  const { c } = useTheme();
  const { intl, t } = useI18n();
  const now = new Date();
  const isCurrent = month === now.getMonth() && year === now.getFullYear();
  const shift = (d: number) => {
    let m = month + d;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    haptic.select();
    onChange(m, y);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <IconButton icon="chevron-left" label={t('common.previous')} onPress={() => shift(-1)} size={22} />
      <PressableScale
        accessibilityRole="button"
        accessibilityHint={isCurrent ? undefined : t('common.backToToday')}
        onPress={() => !isCurrent && onChange(now.getMonth(), now.getFullYear())}
        style={{ flex: 1, alignItems: 'center' }}
      >
        <Animated.View key={`${year}-${month}`} entering={FadeIn.duration(220)} style={{ alignItems: 'center' }}>
          <Text variant="heading" accessibilityLiveRegion="polite">
            {monthName(intl, month)}
            {year !== now.getFullYear() ? ` ${year}` : ''}
          </Text>
          {!isCurrent ? <Text variant="caption" color={c.primary}>{t('common.backToToday')}</Text> : null}
        </Animated.View>
      </PressableScale>
      <IconButton icon="chevron-right" label={t('common.next')} onPress={() => shift(1)} size={22} />
    </View>
  );
}

// --- Icône d'une opération selon son libellé ---

export function txVisual(label: string, income: boolean): { icon: string; color: string } {
  const l = label.toLowerCase();
  const rules: [string[], string, string][] = [
    [['loyer', 'logement', 'rent', 'crédit immo'], 'home', '#E0789B'],
    [['eau', 'water'], 'water-drop', '#4F9BE0'],
    [['élect', 'elect', 'énergie', 'energie', 'edf'], 'bolt', '#E0A93A'],
    [['gaz', 'gas'], 'local-fire-department', '#E9874B'],
    [['course', 'grocer', 'supermarch', 'marché', 'carrefour', 'auchan', 'leclerc'], 'shopping-cart', '#3FB98A'],
    [['shopping', 'vêtement', 'amazon'], 'shopping-bag', '#9586EC'],
    [['cadeau', 'gift'], 'redeem', '#E0789B'],
    [['loisir', 'leisure', 'cinéma', 'netflix', 'spotify'], 'sports-esports', '#E9874B'],
    [['salaire', 'salary', 'paie'], 'account-balance', '#3FB98A'],
    [['sport', 'salle'], 'fitness-center', '#DC5D6E'],
    [['resto', 'restaurant', 'café'], 'restaurant', '#E9874B'],
    [['transport', 'essence', 'carburant', 'fuel', 'uber', 'taxi', 'train'], 'directions-car', '#5C7FE0'],
    [['épargne', 'epargne', 'savings'], 'savings', '#C98A3E'],
    [['santé', 'pharma', 'médecin', 'docteur'], 'local-hospital', '#DC5D6E'],
    [['école', 'ecole', 'scolar', 'school'], 'school', '#6E78D8'],
    [['téléphone', 'telephone', 'mobile', 'internet', 'box'], 'wifi', '#4F9BE0'],
  ];
  for (const [keys, icon, color] of rules) if (keys.some((k) => l.includes(k))) return { icon, color };
  return { icon: income ? 'south-west' : 'receipt', color: income ? '#3FB98A' : '#8D97AD' };
}

// --- Ligne d'opération (glisser vers la gauche pour supprimer) ---

function DeleteAction({ progress, onDelete, label }: { progress: SharedValue<number>; onDelete: () => void; label: string }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], 'clamp') }],
  }));
  return (
    <View style={{ width: 88, alignItems: 'center', justifyContent: 'center' }}>
      <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onDelete} scaleTo={0.9}>
        <Animated.View style={[{ width: 52, height: 52, borderRadius: 18, backgroundColor: c.errorContainer, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Icon name="delete-outline" size={24} color={c.error} />
        </Animated.View>
      </PressableScale>
    </View>
  );
}

export function TransactionRow({
  label,
  subtitle,
  amount,
  income,
  recurring,
  onPress,
  onDelete,
}: {
  label: string;
  subtitle: string;
  amount: number;
  income: boolean;
  recurring?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const { c } = useTheme();
  const { formatAmount } = useCurrency();
  const { t } = useI18n();
  const swipe = useRef<SwipeableMethods>(null);
  const v = txVisual(label, income);

  const row = (
    <PressableScale accessibilityRole="button" accessibilityHint={onDelete ? t('tx.swipeHint') : undefined} onPress={onPress} scaleTo={0.985} style={{ backgroundColor: c.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
        <IconTile icon={v.icon} color={v.color} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={1}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {recurring ? <Icon name="autorenew" size={13} color={c.textMuted} /> : null}
            <Text variant="caption" muted numberOfLines={1} style={{ flexShrink: 1 }}>{subtitle}</Text>
          </View>
        </View>
        <Text variant="amount" color={income ? c.success : c.text} style={{ fontVariant: ['tabular-nums'] }}>
          {income ? '+' : '−'}{formatAmount(amount)}
        </Text>
      </View>
    </PressableScale>
  );

  if (!onDelete) return row;
  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={1.6}
      rightThreshold={44}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic.select()}
      renderRightActions={(progress) => (
        <DeleteAction
          progress={progress}
          label={t('common.delete')}
          onDelete={() => {
            swipe.current?.close();
            onDelete();
          }}
        />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

// --- Enveloppe (anneau + reste) ---

export function EnvelopeCard({ name, icon, color, budgeted, spent, onPress, compact }: { name: string; icon: string; color: string; budgeted: number; spent: number; onPress?: () => void; compact?: boolean }) {
  const { c } = useTheme();
  const { formatAmount } = useCurrency();
  const { t } = useI18n();
  const { scale } = useLayout();
  const tint = envelopeColor(color);
  const remaining = budgeted - spent;
  const percent = budgeted > 0 ? (spent / budgeted) * 100 : 0;
  const state = percent > 100 ? c.error : percent > 85 ? c.warning : tint;

  if (compact) {
    return (
      <PressableScale accessibilityRole="button" onPress={onPress} scaleTo={0.96} style={{ width: scale(132), backgroundColor: c.card, borderRadius: radius.lg, padding: space.md, gap: space.sm }}>
        <Ring value={percent} color={state} size={48} thickness={5}>
          <Icon name={icon} size={20} color={tint} />
        </Ring>
        <Text variant="label" numberOfLines={1}>{name}</Text>
        <Text variant="caption" color={remaining < 0 ? c.error : c.textMuted} numberOfLines={1}>
          {remaining < 0 ? t('env.overBy', { amount: formatAmount(-remaining) }) : t('env.left', { amount: formatAmount(remaining) })}
        </Text>
      </PressableScale>
    );
  }

  return (
    <PressableScale accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={icon} color={tint} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={1}>{name}</Text>
          <Text variant="caption" muted>{t('env.spentOf', { spent: formatAmount(spent), budget: formatAmount(budgeted) })}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text variant="amount" color={remaining < 0 ? c.error : c.text} style={{ fontVariant: ['tabular-nums'] }}>{formatAmount(Math.abs(remaining))}</Text>
          <Text variant="caption" muted>{remaining < 0 ? t('env.over') : t('env.remaining')}</Text>
        </View>
      </View>
      <ProgressBar value={percent} color={state} height={8} />
    </PressableScale>
  );
}
