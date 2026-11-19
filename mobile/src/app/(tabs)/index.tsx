import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EnvelopeCard, TransactionRow } from '@/components/budget';
import { TrendChart } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { AnimatedAmount, Guilloche } from '@/components/motion';
import { TabHeader } from '@/components/TabHeader';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, radius, SectionTitle, space, Text, useContentStyle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { computeBudgetHealth, computeMonthlySnapshot, filterByMonth, totalDepenses, totalRevenus } from '@/lib/calculations';
import { useCurrency } from '@/lib/currency';
import { compareDateStrings } from '@/lib/dates';
import { monthForecast, upcomingRecurring } from '@/lib/forecast';
import { formatDayMonth, monthName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { listWithDeleted, useStore } from '@/lib/repo';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useLayout } from '@/theme/layout';
import { useTheme } from '@/theme/theme';

export default function Home() {
  const tabSpace = useTabBarSpace();
  const column = useContentStyle();
  const { gutter } = useLayout();
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const deleteTx = useDeleteWithUndo();
  const [heroWidth, setHeroWidth] = useState(0);

  const revenus = useStore('revenus');
  const depenses = useStore('depenses');
  const envelopes = useStore('envelopes');

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const snap = useMemo(() => computeMonthlySnapshot(revenus, depenses, envelopes, month, year), [revenus, depenses, envelopes, month, year]);
  const health = useMemo(() => computeBudgetHealth(snap), [snap]);
  // Les échéances récurrentes pas encore tombées (loyer du 28…) sont déjà engagées : on les déduit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const upcoming = useMemo(() => upcomingRecurring(listWithDeleted('revenus'), listWithDeleted('depenses'), now), [revenus, depenses]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const forecast = useMemo(() => monthForecast(snap.totalRevenus, snap.totalDepenses, upcoming, now), [snap, upcoming]);

  const hasData = revenus.length + depenses.length > 0;
  const over = forecast.leftToSpend < 0;

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      if (m < 0) { m += 12; y--; }
      out.push({ label: monthName(intl, m, 'short').slice(0, 4), value: totalRevenus(filterByMonth(revenus, m, y)) - totalDepenses(filterByMonth(depenses, m, y)) });
    }
    return out;
  }, [revenus, depenses, month, year, intl]);

  const recent = useMemo(() => {
    const envName = new Map(envelopes.map((e) => [e.id, e.name]));
    return [
      ...depenses.map((d) => ({ kind: 'expense' as const, rec: d, sub: (d.envelope_id && envName.get(d.envelope_id)) || t(d.category === 'fixe' ? 'tx.fixedExpense' : 'tx.variableExpense') })),
      ...revenus.map((r) => ({ kind: 'income' as const, rec: r, sub: t(`tx.type.${r.type}`) })),
    ]
      .sort((a, b) => compareDateStrings(a.rec.date, b.rec.date) || b.rec.created_at.localeCompare(a.rec.created_at))
      .slice(0, 5);
  }, [revenus, depenses, envelopes, t]);

  const topWarning = health.warnings[0];
  const firstName = (user?.full_name ?? '').split(' ')[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TabHeader title={monthName(intl, month)} subtitle={firstName ? t('home.hello', { name: firstName }) : undefined} />
      <ScrollView contentContainerStyle={[column, { paddingTop: space.sm, paddingBottom: tabSpace + space.lg, gap: space.xl }]} showsVerticalScrollIndicator={false}>
        {/* Reste à dépenser — le chiffre qui compte, sur un fond guilloché. */}
        <View onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)} style={{ backgroundColor: c.card, borderRadius: radius.xl, overflow: 'hidden' }}>
          <Guilloche width={heroWidth} height={190} color={over ? c.error + '22' : c.guilloche} />
          <View style={{ padding: space.xl, paddingBottom: space.lg, gap: space.xs }}>
            <Text variant="label" muted>{t('home.leftToSpend')}</Text>
            <AnimatedAmount value={forecast.leftToSpend} format={formatAmount} variant="hero" color={over ? c.error : c.text} />
            <Text variant="bodyRegular" color={over ? c.error : c.textMuted}>
              {over
                ? t('home.overForecast')
                : forecast.perDay > 0
                  ? t('home.perDay', { amount: formatAmount(forecast.perDay), n: forecast.daysLeft })
                  : hasData
                    ? t('home.nothingLeft')
                    : t('home.startHint')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.outlineVariant }}>
            <Flow label={t('home.in')} value={formatAmount(snap.totalRevenus)} color={c.success} />
            <View style={{ width: 1, backgroundColor: c.outlineVariant }} />
            <Flow label={t('home.out')} value={formatAmount(snap.totalDepenses)} color={c.text} />
            {forecast.upcomingExpenses > 0 ? (
              <>
                <View style={{ width: 1, backgroundColor: c.outlineVariant }} />
                <Flow label={t('home.upcoming')} value={formatAmount(forecast.upcomingExpenses)} color={c.warning} />
              </>
            ) : null}
          </View>
        </View>

        {!hasData ? (
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1, gap: space.sm }}>
                <Text variant="heading">{t('home.emptyTitle')}</Text>
                <Text variant="bodyRegular" muted>{t('home.emptyHint')}</Text>
              </View>
              <Mascot pose="wave" size={0.5} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={t('tx.newIncome')} variant="secondary" size="md" icon="south-west" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/transaction', params: { type: 'income' } })} />
              <Button title={t('tx.newExpense')} size="md" icon="north-east" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/transaction', params: { type: 'expense' } })} />
            </View>
          </Card>
        ) : null}

        {topWarning ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.warning + '1F', borderRadius: radius.md, padding: space.md }}>
            <Icon name="error-outline" size={20} color={c.warning} />
            <Text variant="label" style={{ flex: 1 }}>{t(topWarning.key, topWarning.params)}</Text>
          </View>
        ) : null}

        {upcoming.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <SectionTitle>{t('home.upcomingTitle')}</SectionTitle>
            {upcoming.slice(0, 4).map((u) => (
              <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <Text variant="heading" style={{ fontSize: 18 }}>{u.date.slice(8, 10)}</Text>
                  <Text variant="caption" muted>{monthName(intl, month, 'short').slice(0, 4)}</Text>
                </View>
                <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{u.label}</Text>
                <Text variant="amount" color={u.kind === 'income' ? c.success : c.text}>{u.kind === 'income' ? '+' : '−'}{formatAmount(u.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {envelopes.length > 0 ? (
          <View style={{ gap: space.md }}>
            <SectionTitle action={t('home.seeBudget')} onAction={() => router.navigate('/budget')}>{t('nav.budget')}</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -gutter }}>
              <View style={{ width: gutter - space.sm }} />
              {snap.envelopeDetails.map((e) => (
                <EnvelopeCard key={e.id} compact name={e.name} icon={e.icon} color={e.color} budgeted={e.budgeted} spent={e.spent} onPress={() => router.push({ pathname: '/envelope', params: { id: e.id } })} />
              ))}
              <View style={{ width: gutter - space.sm }} />
            </ScrollView>
          </View>
        ) : null}

        {recent.length > 0 ? (
          <View>
            <SectionTitle action={t('home.seeAll')} onAction={() => router.navigate('/transactions')}>{t('home.recent')}</SectionTitle>
            <View style={{ marginTop: space.sm }}>
              {recent.map(({ kind, rec, sub }) => (
                <TransactionRow
                  key={rec.id}
                  label={rec.label}
                  subtitle={`${formatDayMonth(rec.date, intl)}, ${sub}`}
                  amount={rec.amount}
                  income={kind === 'income'}
                  recurring={rec.recurring}
                  onPress={() => router.push({ pathname: '/transaction', params: { type: kind, id: rec.id } })}
                  onDelete={() => deleteTx(kind === 'income' ? 'revenus' : 'depenses', rec)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {trend.some((d) => d.value !== 0) ? (
          <View style={{ gap: space.md }}>
            <SectionTitle>{t('home.monthlyBalance')}</SectionTitle>
            <Card>
              <TrendChart data={trend} width={Math.max(0, heroWidth - space.lg * 2)} height={120} color={trend[5].value >= 0 ? c.success : c.error} />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Flow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, paddingVertical: space.md, paddingHorizontal: space.lg, gap: 2 }}>
      <Text variant="caption" muted>{label}</Text>
      <Text variant="amount" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
