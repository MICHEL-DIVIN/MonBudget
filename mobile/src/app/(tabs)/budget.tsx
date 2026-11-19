import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { EnvelopeCard } from '@/components/budget';
import { Ring } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { AnimatedAmount } from '@/components/motion';
import { TabHeader } from '@/components/TabHeader';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, EmptyState, PressableScale, radius, Segmented, space, Text, useContentStyle } from '@/components/ui';
import { computeMonthlySnapshot, filterByMonth } from '@/lib/calculations';
import { useCurrency } from '@/lib/currency';
import { toLocalDate } from '@/lib/dates';
import { monthForecast, upcomingRecurring } from '@/lib/forecast';
import { formatFullDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { listWithDeleted, useStore } from '@/lib/repo';
import type { Objectif } from '@/lib/types';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme';

type View_ = 'envelopes' | 'goals';

export default function Budget() {
  const tabSpace = useTabBarSpace();
  const column = useContentStyle();
  const { gutter } = useLayout();
  const { c } = useTheme();
  const { t } = useI18n();
  const [tab, setTab] = useState<View_>('envelopes');
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TabHeader title={t('nav.budget')}>
        <Segmented<View_> value={tab} onChange={setTab} options={[{ value: 'envelopes', label: t('env.title') }, { value: 'goals', label: t('goal.titlePlural') }]} />
      </TabHeader>
      <ScrollView contentContainerStyle={[column, { paddingTop: space.sm, paddingBottom: tabSpace + space.lg, gap: space.md }]} showsVerticalScrollIndicator={false}>
        <Animated.View key={tab} entering={FadeIn.duration(220)} style={{ gap: space.md }}>
          {tab === 'envelopes' ? <Envelopes /> : <Goals />}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Envelopes() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { formatAmount } = useCurrency();
  const envelopes = useStore('envelopes');
  const revenus = useStore('revenus');
  const depenses = useStore('depenses');
  const now = new Date();
  const snap = useMemo(() => computeMonthlySnapshot(revenus, depenses, envelopes, now.getMonth(), now.getFullYear()), [revenus, depenses, envelopes]); // eslint-disable-line react-hooks/exhaustive-deps
  const forecast = useMemo(() => monthForecast(snap.totalRevenus, snap.totalDepenses, upcomingRecurring(listWithDeleted('revenus'), listWithDeleted('depenses'), now), now), [snap]); // eslint-disable-line react-hooks/exhaustive-deps

  const unassigned = filterByMonth(depenses, now.getMonth(), now.getFullYear())
    .filter((d) => !d.envelope_id || !envelopes.some((e) => e.id === d.envelope_id))
    .reduce((s, d) => s + d.amount, 0);
  // « À répartir » : revenus attendus du mois moins ce qui est déjà promis aux enveloppes.
  const toAssign = forecast.expectedIncome - snap.totalBudgeted;
  const sorted = [...snap.envelopeDetails].sort((a, b) => b.percent - a.percent);

  if (envelopes.length === 0) {
    return (
      <EmptyState
        icon="donut-large"
        title={t('env.empty')}
        hint={t('env.emptyHint')}
        action={<Button title={t('env.add')} icon="add" onPress={() => router.push('/envelope')} />}
      />
    );
  }

  const pct = snap.totalBudgeted > 0 ? (snap.totalEnvelopeSpent / snap.totalBudgeted) * 100 : 0;
  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.xl, padding: space.xl }}>
        <Ring value={pct} color={pct > 100 ? c.error : pct > 85 ? c.warning : c.primary} size={92} thickness={9}>
          <Text variant="heading">{Math.round(pct)}%</Text>
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" muted>{t('env.leftInEnvelopes')}</Text>
          <AnimatedAmount value={snap.totalBudgeted - snap.totalEnvelopeSpent} format={formatAmount} variant="title" color={snap.totalBudgeted - snap.totalEnvelopeSpent < 0 ? c.error : c.text} />
          <Text variant="caption" muted>{t('env.spentOf', { spent: formatAmount(snap.totalEnvelopeSpent), budget: formatAmount(snap.totalBudgeted) })}</Text>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Fact
          icon={toAssign >= 0 ? 'account-balance-wallet' : 'error-outline'}
          color={toAssign >= 0 ? c.success : c.error}
          label={toAssign >= 0 ? t('env.toAssign') : t('env.overAssigned')}
          value={formatAmount(Math.abs(toAssign))}
        />
        <Fact icon="help-outline" color={c.textMuted} label={t('env.unassigned')} value={formatAmount(unassigned)} />
      </View>

      {sorted.map((e) => (
        <Animated.View key={e.id} layout={LinearTransition}>
          <EnvelopeCard name={e.name} icon={e.icon} color={e.color} budgeted={e.budgeted} spent={e.spent} onPress={() => router.push({ pathname: '/envelope', params: { id: e.id } })} />
        </Animated.View>
      ))}
      <Button title={t('env.add')} icon="add" variant="secondary" onPress={() => router.push('/envelope')} />
    </>
  );
}

function Fact({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: radius.md, padding: space.md, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} color={color} />
        <Text variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      </View>
      <Text variant="amount" color={color === c.textMuted ? c.text : color} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Goals() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { formatAmount } = useCurrency();
  const goals = useStore('objectifs');
  const saved = goals.reduce((s, g) => s + g.current_amount, 0);
  const target = goals.reduce((s, g) => s + g.target_amount, 0);

  if (goals.length === 0) {
    return <EmptyState icon="savings" title={t('goal.empty')} hint={t('goal.emptyHint')} action={<Button title={t('goal.new')} icon="add" onPress={() => router.push('/goal')} />} />;
  }

  return (
    <>
      <Card style={{ gap: space.xs, borderRadius: radius.xl, padding: space.xl }}>
        <Text variant="caption" muted>{t('goal.totalSaved')}</Text>
        <AnimatedAmount value={saved} format={formatAmount} variant="display" />
        <Text variant="caption" muted>{t('goal.ofTarget', { target: formatAmount(target) })}</Text>
      </Card>
      {goals.map((g) => (
        <Animated.View key={g.id} layout={LinearTransition}>
          <GoalCard goal={g} />
        </Animated.View>
      ))}
      <Button title={t('goal.new')} icon="add" variant="secondary" onPress={() => router.push('/goal')} />
    </>
  );
}

function GoalCard({ goal }: { goal: Objectif }) {
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const { formatAmount } = useCurrency();
  const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
  const reached = pct >= 100;
  const daysLeft = goal.deadline ? Math.ceil((toLocalDate(goal.deadline).getTime() - Date.now()) / 86_400_000) : null;
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  // Effort mensuel nécessaire pour tenir l'échéance : plus parlant qu'une date seule.
  const monthsLeft = daysLeft !== null && daysLeft > 0 ? Math.max(1, Math.ceil(daysLeft / 30.4)) : null;
  const color = reached ? c.success : c.primary;

  return (
    <PressableScale accessibilityRole="button" onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} scaleTo={0.98} style={{ backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        <Ring value={pct} color={color} size={64} thickness={6}>
          <Icon name={reached ? 'emoji-events' : 'savings'} size={24} color={color} />
        </Ring>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>{goal.label}</Text>
          <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
            {formatAmount(goal.current_amount)} <Text variant="label" muted>/ {formatAmount(goal.target_amount)}</Text>
          </Text>
          {reached ? (
            <Text variant="caption" color={c.success}>{t('goal.reached')}</Text>
          ) : goal.deadline ? (
            <Text variant="caption" color={daysLeft !== null && daysLeft < 0 ? c.error : c.textMuted}>
              {daysLeft !== null && daysLeft < 0
                ? t('goal.overdueSince', { date: formatFullDate(goal.deadline, intl) })
                : monthsLeft
                  ? t('goal.perMonth', { amount: formatAmount(remaining / monthsLeft), date: formatFullDate(goal.deadline, intl) })
                  : formatFullDate(goal.deadline, intl)}
            </Text>
          ) : (
            <Text variant="caption" muted>{t('goal.remaining', { amount: formatAmount(remaining) })}</Text>
          )}
        </View>
      </View>
      {!reached ? <Button title={t('goal.addFunds')} size="md" variant="secondary" icon="add" onPress={() => router.push({ pathname: '/contribute', params: { id: goal.id } })} /> : null}
    </PressableScale>
  );
}
