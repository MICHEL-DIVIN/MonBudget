import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/charts';
import { AmountDisplay, Keypad } from '@/components/Keypad';
import { useToast } from '@/components/Toast';
import { Button, Chip, haptic, radius, space, Text } from '@/components/ui';
import { amountFromInput, applyKey, inputFromAmount } from '@/lib/amount';
import { useCurrency } from '@/lib/currency';
import { todayString } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getById, save } from '@/lib/repo';
import { useTheme } from '@/theme/theme';

/**
 * Verser de l'argent sur un objectif. Par défaut, le versement est aussi enregistré comme
 * dépense fixe du mois : l'argent mis de côté n'est plus « disponible », le reste à dépenser reste juste.
 */
export default function ContributeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { t } = useI18n();
  const { formatAmount, symbol, currency } = useCurrency();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const goal = id ? getById('objectifs', id) : null;
  const decimals = currency === 'XOF' || currency === 'XAF' ? 0 : 2;
  const [amount, setAmount] = useState('');
  const [countAsExpense, setCountAsExpense] = useState(true);
  const [shake, setShake] = useState(0);

  if (!goal) return null;
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const value = amountFromInput(amount);
  const after = goal.current_amount + value;

  function submit() {
    if (!goal || !(value > 0)) {
      haptic.warn();
      setShake((n) => n + 1);
      return;
    }
    save('objectifs', { ...goal, current_amount: Math.round(after * 100) / 100 });
    if (countAsExpense) {
      save('depenses', { label: t('goal.contributionLabel', { label: goal.label }), amount: value, category: 'fixe', envelope_id: null, date: todayString(), recurring: false, recurring_group_id: null });
    }
    haptic.success();
    toast({ message: after >= goal.target_amount ? t('goal.reachedToast', { label: goal.label }) : t('goal.contributed', { amount: formatAmount(value) }), icon: after >= goal.target_amount ? 'emoji-events' : 'savings' });
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: goal.label }} />
      <View style={{ flex: 1, padding: space.lg, gap: space.lg, justifyContent: 'center' }}>
        <AmountDisplay value={amount} symbol={symbol} color={c.primary} shakeKey={shake} />
        <View style={{ gap: space.sm }}>
          <ProgressBar value={goal.target_amount > 0 ? (after / goal.target_amount) * 100 : 0} color={after >= goal.target_amount ? c.success : c.primary} height={10} />
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            {t('goal.afterContribution', { amount: formatAmount(after), target: formatAmount(goal.target_amount) })}
          </Text>
        </View>
        {remaining > 0 ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Chip label={t('goal.fillRemaining', { amount: formatAmount(remaining) })} onPress={() => setAmount(inputFromAmount(remaining))} />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.card, borderRadius: radius.md, padding: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="body">{t('goal.countAsExpense')}</Text>
            <Text variant="caption" muted>{t('goal.countAsExpenseHint')}</Text>
          </View>
          <Switch value={countAsExpense} onValueChange={setCountAsExpense} trackColor={{ true: c.primary, false: c.outline }} thumbColor="#fff" accessibilityLabel={t('goal.countAsExpense')} />
        </View>
      </View>
      <View style={{ paddingHorizontal: space.md, paddingBottom: insets.bottom + space.md, gap: space.md }}>
        <Keypad decimals={decimals} onKey={(k) => setAmount((a) => applyKey(a, k, decimals))} />
        <Button title={t('goal.contribute')} icon="savings" onPress={submit} />
      </View>
    </View>
  );
}
