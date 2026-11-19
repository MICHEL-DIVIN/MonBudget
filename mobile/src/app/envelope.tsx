import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { TransactionRow } from '@/components/budget';
import { Ring } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Button, Card, Field, haptic, PressableScale, radius, Screen, SectionTitle, space, Text } from '@/components/ui';
import { filterByMonth } from '@/lib/calculations';
import { useCurrency } from '@/lib/currency';
import { compareDateStrings } from '@/lib/dates';
import { formatDayMonth, parseDecimal } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getById, remove, save, useStore } from '@/lib/repo';
import { ENVELOPE_COLORS, envelopeColor, useTheme } from '@/theme/theme';

const ICONS = ['shopping_cart', 'home', 'bolt', 'restaurant', 'directions_car', 'shopping_bag', 'redeem', 'sports_esports', 'local_hospital', 'school', 'child_care', 'pets', 'phone_iphone', 'wifi', 'water_drop', 'fitness_center', 'flight', 'category'];

/** Création / modification d'une enveloppe, avec ses dépenses du mois. */
export default function EnvelopeScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const { formatAmount, symbol } = useCurrency();
  const toast = useToast();
  const envelopes = useStore('envelopes');
  const depenses = useStore('depenses');
  const existing = id ? getById('envelopes', id) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [budget, setBudget] = useState(existing ? String(existing.budgeted).replace('.', ',') : '');
  const [color, setColor] = useState(existing?.color ?? 'bg-env-green');
  const [icon, setIcon] = useState(existing?.icon ?? 'shopping_cart');
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const spentItems = useMemo(
    () => (existing ? filterByMonth(depenses, now.getMonth(), now.getFullYear()).filter((d) => d.envelope_id === existing.id).sort((a, b) => compareDateStrings(a.date, b.date)) : []),
    [depenses, existing?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const spent = spentItems.reduce((s, d) => s + d.amount, 0);
  const budgetValue = parseDecimal(budget || '0');
  const tint = envelopeColor(color);
  const pct = budgetValue > 0 ? (spent / budgetValue) * 100 : 0;

  function submit() {
    if (!name.trim()) return setError(t('env.nameRequired'));
    if (!(budgetValue >= 0)) return setError(t('tx.amountInvalid'));
    save('envelopes', {
      id: existing?.id,
      name: name.trim(),
      budgeted: Math.round(budgetValue * 100) / 100,
      color,
      icon,
      sort_order: existing?.sort_order ?? envelopes.length,
    });
    haptic.success();
    toast({ message: existing ? t('env.saved') : t('env.created') });
    router.back();
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert(t('env.deleteTitle'), t('env.deleteBody', { name: existing.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove('envelopes', existing.id);
          toast({ message: t('env.deleted'), icon: 'delete-outline' });
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen keyboard footer={<Button title={existing ? t('common.save') : t('env.create')} onPress={submit} />}>
      <Stack.Screen options={{ title: existing ? existing.name : t('env.add') }} />

      {/* Aperçu vivant : l'enveloppe telle qu'elle apparaîtra. */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.xl }}>
        <Ring value={pct} color={pct > 100 ? c.error : pct > 85 ? c.warning : tint} size={72} thickness={7}>
          <Icon name={icon} size={28} color={tint} />
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>{name.trim() || t('env.nameHint')}</Text>
          <Text variant="caption" muted>{t('env.spentOf', { spent: formatAmount(spent), budget: formatAmount(budgetValue || 0) })}</Text>
        </View>
      </Card>

      <Field label={t('env.name')} value={name} onChangeText={setName} placeholder={t('env.nameHint')} autoFocus={!existing} />
      <Field label={`${t('env.budget')} (${symbol})`} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="0" hint={t('env.budgetHint')} />

      <View style={{ gap: space.sm }}>
        <Text variant="label" muted>{t('env.color')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {Object.keys(ENVELOPE_COLORS).slice(0, 8).map((k) => (
            <PressableScale
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: color === k }}
              accessibilityLabel={k.replace('bg-', '')}
              onPress={() => { haptic.select(); setColor(k); }}
              scaleTo={0.85}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ENVELOPE_COLORS[k], borderWidth: 3, borderColor: color === k ? c.text : 'transparent' }}
            >
              <View />
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text variant="label" muted>{t('env.icon')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {ICONS.map((k) => (
            <PressableScale
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: icon === k }}
              accessibilityLabel={k.replace(/_/g, ' ')}
              onPress={() => { haptic.select(); setIcon(k); }}
              scaleTo={0.88}
              style={{ width: 46, height: 46, borderRadius: radius.sm + 4, alignItems: 'center', justifyContent: 'center', backgroundColor: icon === k ? tint + '30' : c.card, borderWidth: 1.5, borderColor: icon === k ? tint : 'transparent' }}
            >
              <Icon name={k} size={22} color={icon === k ? tint : c.textMuted} />
            </PressableScale>
          ))}
        </View>
      </View>

      {error ? <Text variant="label" color={c.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      {existing && spentItems.length > 0 ? (
        <View>
          <SectionTitle>{t('env.thisMonth')}</SectionTitle>
          {spentItems.map((d) => (
            <TransactionRow key={d.id} label={d.label} subtitle={formatDayMonth(d.date, intl)} amount={d.amount} income={false} recurring={d.recurring} onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense', id: d.id } })} />
          ))}
        </View>
      ) : null}

      {existing ? <Button title={t('env.delete')} variant="danger" icon="delete-outline" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
