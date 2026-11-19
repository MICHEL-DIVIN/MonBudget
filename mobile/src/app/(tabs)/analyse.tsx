import { useMemo, useState } from 'react';
import { Alert, ScrollView, useWindowDimensions, View } from 'react-native';
import { BarChart, Donut, Legend, ProgressBar, TrendChart } from '@/components/charts';
import { AnimatedAmount } from '@/components/motion';
import { TabHeader } from '@/components/TabHeader';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, IconButton, radius, SectionTitle, space, Text, useContentStyle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { computeAnnualReport, filterByYear } from '@/lib/calculations';
import { useCurrency } from '@/lib/currency';
import { exportAnnualPdf } from '@/lib/export';
import { monthName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useStore } from '@/lib/repo';
import { useLayout } from '@/theme/layout';
import { envelopeColor, useTheme } from '@/theme/theme';

export default function Analyse() {
  const tabSpace = useTabBarSpace();
  const column = useContentStyle();
  const { gutter, contentWidth } = useLayout();
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const revenus = useStore('revenus');
  const depenses = useStore('depenses');
  const envelopes = useStore('envelopes');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [exporting, setExporting] = useState(false);

  const report = useMemo(
    () => computeAnnualReport(revenus, depenses, envelopes, year, filterByYear(revenus, year - 1), filterByYear(depenses, year - 1)),
    [revenus, depenses, envelopes, year],
  );

  // Où va l'argent : dépenses de l'année par enveloppe (le reste regroupé).
  const breakdown = useMemo(() => {
    const yearDep = filterByYear(depenses, year);
    const byEnv = new Map<string, number>();
    for (const d of yearDep) byEnv.set(d.envelope_id ?? '', (byEnv.get(d.envelope_id ?? '') ?? 0) + d.amount);
    const rows = [...byEnv.entries()]
      .map(([id, value]) => {
        const env = envelopes.find((e) => e.id === id);
        return { label: env?.name ?? t('analysis.noEnvelope'), value, color: env ? envelopeColor(env.color) : c.outline };
      })
      .sort((a, b) => b.value - a.value);
    return rows;
  }, [depenses, envelopes, year, t, c.outline]);

  const chartW = contentWidth - gutter * 2 - space.lg * 2;
  const hasData = report.activeMonths > 0;
  const isCurrentYear = year === now.getFullYear();
  const trendLabel = isCurrentYear ? t('analysis.vsSamePeriod', { year: year - 1 }) : t('analysis.vsYear', { year: year - 1 });

  async function doExport() {
    setExporting(true);
    try {
      await exportAnnualPdf({ report, year, userName: user?.full_name ?? '', t, intl, fmt: formatAmount });
    } catch {
      Alert.alert(t('error.generic'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TabHeader title={t('nav.analysis')}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton icon="chevron-left" label={t('common.previous')} onPress={() => setYear((y) => y - 1)} size={22} />
          <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>{year}</Text>
          <IconButton icon="chevron-right" label={t('common.next')} onPress={() => setYear((y) => y + 1)} size={22} />
        </View>
      </TabHeader>
      <ScrollView contentContainerStyle={[column, { paddingTop: space.sm, paddingBottom: tabSpace + space.lg, gap: space.lg }]} showsVerticalScrollIndicator={false}>
        {!hasData ? (
          <Card style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
            <Text variant="heading">{t('sum.empty', { year })}</Text>
            <Text variant="bodyRegular" muted style={{ textAlign: 'center' }}>{t('analysis.emptyHint')}</Text>
          </Card>
        ) : (
          <>
            <Card style={{ borderRadius: radius.xl, padding: space.xl, gap: space.lg }}>
              <View style={{ gap: 2 }}>
                <Text variant="label" muted>{t('sum.netSavings')}</Text>
                <AnimatedAmount value={report.totalEpargne} format={formatAmount} variant="display" color={report.totalEpargne < 0 ? c.error : c.text} />
                <Text variant="caption" muted>
                  {t('analysis.rate', { pct: report.tauxEpargneMoyen.toFixed(0) })}
                  {Number.isFinite(report.epargneTrend) && report.epargneTrend !== 0 ? `, ${report.epargneTrend > 0 ? '+' : ''}${report.epargneTrend.toFixed(0)} % ${trendLabel}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <Kpi label={t('sum.totalIncome')} value={formatAmount(report.totalRevenus)} trend={report.revenuTrend} good />
                <Kpi label={t('sum.totalExpenses')} value={formatAmount(report.totalDepenses)} trend={report.depenseTrend} />
              </View>
            </Card>

            {breakdown.length > 0 ? (
              <>
                <SectionTitle>{t('analysis.whereMoneyGoes')}</SectionTitle>
                <Card style={{ gap: space.lg, alignItems: 'center' }}>
                  <Donut slices={breakdown} size={180} thickness={20}>
                    <Text variant="caption" muted>{t('sum.totalExpenses')}</Text>
                    <Text variant="heading">{formatAmount(report.totalDepenses)}</Text>
                  </Donut>
                  <View style={{ alignSelf: 'stretch', gap: space.sm }}>
                    {breakdown.slice(0, 6).map((b) => (
                      <View key={b.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: b.color }} />
                        <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{b.label}</Text>
                        <Text variant="caption" muted>{Math.round((b.value / report.totalDepenses) * 100)} %</Text>
                        <Text variant="label" style={{ width: 96, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{formatAmount(b.value)}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            <SectionTitle>{t('sum.incomeVsExpenses')}</SectionTitle>
            <Card style={{ gap: space.md }}>
              <BarChart
                width={chartW}
                colorA={c.success}
                colorB={c.error}
                highlight={isCurrentYear ? now.getMonth() : undefined}
                data={report.months.map((m, i) => ({ label: monthName(intl, i, 'short').charAt(0), a: m.totalRevenus, b: m.totalDepenses }))}
              />
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <Legend color={c.success} label={t('home.in')} />
                <Legend color={c.error} label={t('home.out')} />
              </View>
            </Card>

            <SectionTitle>{t('sum.cumulative')}</SectionTitle>
            <Card>
              <TrendChart
                width={chartW}
                height={130}
                color={report.cumulativeSavings[Math.max(0, report.monthsElapsed - 1)] >= 0 ? c.success : c.error}
                data={report.cumulativeSavings.slice(0, Math.max(2, report.monthsElapsed)).map((v, i) => ({ label: monthName(intl, i, 'short').charAt(0), value: v }))}
              />
            </Card>

            <SectionTitle>{t('sum.monthly')}</SectionTitle>
            <Card style={{ paddingVertical: space.sm }}>
              {report.months.map((m, i) => {
                if (m.totalRevenus === 0 && m.totalDepenses === 0) return null;
                const status = m.tauxEpargne >= 10 ? 'ok' : m.tauxEpargne >= 0 ? 'limit' : 'deficit';
                const color = status === 'ok' ? c.success : status === 'limit' ? c.warning : c.error;
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}>
                    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} accessibilityLabel={t(`sum.status.${status}`)} />
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{monthName(intl, i)}</Text>
                      <Text variant="caption" muted numberOfLines={1}>{t('analysis.inOut', { in: formatAmount(m.totalRevenus), out: formatAmount(m.totalDepenses) })}</Text>
                    </View>
                    <Text variant="amount" color={m.epargne < 0 ? c.error : c.text} style={{ fontVariant: ['tabular-nums'] }}>{m.epargne >= 0 ? '+' : '−'}{formatAmount(Math.abs(m.epargne))}</Text>
                  </View>
                );
              })}
            </Card>

            {report.envelopeAnnual.some((e) => e.annualBudget > 0) ? (
              <>
                <SectionTitle>{t('sum.envelopePerf')}</SectionTitle>
                <Card style={{ gap: space.lg }}>
                  {report.envelopeAnnual.filter((e) => e.annualBudget > 0).map((e) => (
                    <View key={e.id} style={{ gap: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                        <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>{e.name}</Text>
                        <Text variant="caption" muted>{formatAmount(e.totalSpent)} / {formatAmount(e.annualBudget)}</Text>
                      </View>
                      <ProgressBar value={e.adherence} color={e.adherence > 100 ? c.error : e.adherence > 85 ? c.warning : envelopeColor(e.color)} />
                    </View>
                  ))}
                  <Text variant="caption" muted>{t('analysis.prorataHint')}</Text>
                </Card>
              </>
            ) : null}

            <Button title={t('analysis.exportPdf', { year })} icon="picture-as-pdf" variant="secondary" loading={exporting} onPress={doExport} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value, trend, good }: { label: string; value: string; trend: number; good?: boolean }) {
  const { c } = useTheme();
  const up = trend >= 0;
  const positive = good ? up : !up;
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" muted numberOfLines={1}>{label}</Text>
      <Text variant="amount" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      {Number.isFinite(trend) && trend !== 0 ? (
        <Text variant="caption" color={positive ? c.success : c.error}>{up ? '▲' : '▼'} {Math.abs(trend).toFixed(0)} %</Text>
      ) : null}
    </View>
  );
}
