import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { MonthSelector, TransactionRow } from '@/components/budget';
import { Icon } from '@/components/Icon';
import { TabHeader } from '@/components/TabHeader';
import { useTabBarSpace } from '@/components/TabBar';
import { Chip, EmptyState, IconButton, radius, Segmented, space, Text, useContentStyle } from '@/components/ui';
import { filterByMonth } from '@/lib/calculations';
import { useCurrency } from '@/lib/currency';
import { compareDateStrings } from '@/lib/dates';
import { dayGroupLabel } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useStore } from '@/lib/repo';
import type { Depense, Revenu } from '@/lib/types';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useLayout } from '@/theme/layout';
import { envelopeColor, font, useTheme } from '@/theme/theme';

type Filter = 'all' | 'income' | 'expense';
type Item = { kind: 'income'; rec: Revenu; sub: string } | { kind: 'expense'; rec: Depense; sub: string };

export default function Transactions() {
  const tabSpace = useTabBarSpace();
  const column = useContentStyle();
  const { gutter } = useLayout();
  const { c } = useTheme();
  const { t, intl } = useI18n();
  const { formatAmount } = useCurrency();
  const deleteTx = useDeleteWithUndo();
  const revenus = useStore('revenus');
  const depenses = useStore('depenses');
  const envelopes = useStore('envelopes');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filter, setFilter] = useState<Filter>('all');
  const [envelopeFilter, setEnvelopeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const monthRev = useMemo(() => filterByMonth(revenus, month, year), [revenus, month, year]);
  const monthDep = useMemo(() => filterByMonth(depenses, month, year), [depenses, month, year]);
  const totalIn = monthRev.reduce((s, r) => s + r.amount, 0);
  const totalOut = monthDep.reduce((s, d) => s + d.amount, 0);

  const groups = useMemo(() => {
    const envName = new Map(envelopes.map((e) => [e.id, e.name]));
    const q = query.trim().toLowerCase();
    const items: Item[] = [
      ...(filter !== 'expense' ? monthRev.map((r) => ({ kind: 'income' as const, rec: r, sub: `${t(`tx.type.${r.type}`)}, ${t(`tx.cat.${r.category}`).toLowerCase()}` })) : []),
      ...(filter !== 'income'
        ? monthDep
            .filter((d) => !envelopeFilter || d.envelope_id === envelopeFilter)
            .map((d) => ({ kind: 'expense' as const, rec: d, sub: (d.envelope_id && envName.get(d.envelope_id)) || t(`tx.cat.${d.category}`) }))
        : []),
    ].filter((i) => !q || i.rec.label.toLowerCase().includes(q));

    items.sort((a, b) => compareDateStrings(a.rec.date, b.rec.date) || b.rec.created_at.localeCompare(a.rec.created_at));
    const map = new Map<string, { label: string; net: number; items: Item[] }>();
    for (const it of items) {
      const key = it.rec.date;
      const g = map.get(key) ?? { label: dayGroupLabel(key, intl, t('common.today'), t('common.yesterday')), net: 0, items: [] };
      g.items.push(it);
      g.net += it.kind === 'income' ? it.rec.amount : -it.rec.amount;
      map.set(key, g);
    }
    return [...map.entries()];
  }, [monthRev, monthDep, envelopes, filter, envelopeFilter, query, intl, t]);

  const filtering = !!query || filter !== 'all' || !!envelopeFilter;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <TabHeader title={t('nav.transactions')}>
        <MonthSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </TabHeader>
      <ScrollView contentContainerStyle={[column, { paddingBottom: tabSpace + space.lg, gap: space.lg }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Total label={t('home.in')} value={formatAmount(totalIn)} color={c.success} />
          <Total label={t('home.out')} value={formatAmount(totalOut)} color={c.text} />
          <Total label={t('tx.net')} value={formatAmount(totalIn - totalOut)} color={totalIn - totalOut < 0 ? c.error : c.text} />
        </View>

        <Segmented<Filter>
          value={filter}
          onChange={(f) => { setFilter(f); if (f === 'income') setEnvelopeFilter(null); }}
          options={[{ value: 'all', label: t('common.all') }, { value: 'income', label: t('nav.income') }, { value: 'expense', label: t('nav.expenses') }]}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: c.card, borderRadius: radius.md, paddingHorizontal: space.md }}>
          <Icon name="search" size={20} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.searchPlaceholder')}
            placeholderTextColor={c.textMuted}
            selectionColor={c.primary}
            accessibilityLabel={t('common.search')}
            returnKeyType="search"
            style={{ flex: 1, color: c.text, fontFamily: font.medium, fontSize: 15, paddingVertical: 12 }}
          />
          {query ? <IconButton icon="close" size={18} color={c.textMuted} label={t('common.clear')} onPress={() => setQuery('')} /> : null}
        </View>

        {filter !== 'income' && envelopes.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -gutter }}>
            <View style={{ width: gutter - space.sm }} />
            {envelopes.map((e) => (
              <Chip key={e.id} label={e.name} color={envelopeColor(e.color)} active={envelopeFilter === e.id} onPress={() => setEnvelopeFilter(envelopeFilter === e.id ? null : e.id)} />
            ))}
            <View style={{ width: gutter - space.sm }} />
          </ScrollView>
        ) : null}

        {groups.length === 0 ? (
          <EmptyState
            icon={filtering ? 'search-off' : 'receipt-long'}
            title={filtering ? t('common.noResults') : t('tx.emptyMonth')}
            hint={filtering ? t('tx.noResultsHint') : t('tx.emptyMonthHint')}
          />
        ) : (
          groups.map(([key, g]) => (
            <Animated.View key={key} layout={LinearTransition.springify().damping(20)} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 2 }}>
                <Text variant="label" muted>{g.label}</Text>
                <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>{g.net >= 0 ? '+' : '−'}{formatAmount(Math.abs(g.net))}</Text>
              </View>
              {g.items.map((it) => (
                <Animated.View key={it.rec.id} layout={LinearTransition.springify().damping(20)} exiting={FadeOut.duration(150)}>
                  <TransactionRow
                    label={it.rec.label}
                    subtitle={it.sub}
                    amount={it.rec.amount}
                    income={it.kind === 'income'}
                    recurring={it.rec.recurring}
                    onPress={() => router.push({ pathname: '/transaction', params: { type: it.kind, id: it.rec.id } })}
                    onDelete={() => deleteTx(it.kind === 'income' ? 'revenus' : 'depenses', it.rec)}
                  />
                </Animated.View>
              ))}
            </Animated.View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: radius.md, padding: space.md, gap: 2 }}>
      <Text variant="caption" muted>{label}</Text>
      <Text variant="amount" color={color} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
