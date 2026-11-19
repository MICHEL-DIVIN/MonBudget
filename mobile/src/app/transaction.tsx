import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateStrip, OptionCards, TileGrid } from '@/components/pickers';
import { AmountDisplay, Keypad } from '@/components/Keypad';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { Button, Chip, haptic, IconButton, IconTile, PressableScale, radius, Segmented, space, Text, useContentStyle } from '@/components/ui';
import { amountFromInput, applyKey, inputFromAmount } from '@/lib/amount';
import { useCurrency } from '@/lib/currency';
import { compareDateStrings } from '@/lib/dates';
import { todayString } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getById, listAll, remove, save, saveMany, useStore } from '@/lib/repo';
import type { Depense, Revenu } from '@/lib/types';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useLayout } from '@/theme/layout';
import { envelopeColor, font, useTheme } from '@/theme/theme';

const INCOME_TYPES = [
  { key: 'salaire', icon: 'work', color: '#3FB98A' },
  { key: 'freelance', icon: 'laptop-mac', color: '#4F9BE0' },
  { key: 'immobilier', icon: 'apartment', color: '#9586EC' },
  { key: 'allocation', icon: 'volunteer-activism', color: '#E0789B' },
  { key: 'autre', icon: 'more-horiz', color: '#8D97AD' },
] as const;
type Kind = 'income' | 'expense';

/** Saisie / modification d'une opération : le montant d'abord, le reste en un coup d'œil. */
export default function TransactionScreen() {
  const params = useLocalSearchParams<{ type?: string; id?: string }>();
  const { c } = useTheme();
  const { t } = useI18n();
  const { symbol, currency } = useCurrency();
  const toast = useToast();
  const deleteTx = useDeleteWithUndo();
  const insets = useSafeAreaInsets();
  const { short } = useLayout();
  const column = useContentStyle();
  const envelopes = useStore('envelopes');
  const revenus = useStore('revenus');
  const depenses = useStore('depenses');

  const initialKind: Kind = params.type === 'income' ? 'income' : 'expense';
  const existing = params.id ? (initialKind === 'income' ? getById('revenus', params.id) : getById('depenses', params.id)) : null;
  const decimals = currency === 'XOF' || currency === 'XAF' ? 0 : 2;

  const [kind, setKind] = useState<Kind>(initialKind);
  const [amount, setAmount] = useState(existing ? inputFromAmount(existing.amount) : '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [date, setDate] = useState(existing?.date ?? todayString());
  const [category, setCategory] = useState<string>(existing?.category ?? (initialKind === 'income' ? 'principal' : 'variable'));
  const [incomeType, setIncomeType] = useState<string>((existing as Revenu | null)?.type ?? 'salaire');
  const [envelopeId, setEnvelopeId] = useState<string | null>((existing as Depense | null)?.envelope_id ?? null);
  const [recurring, setRecurring] = useState(existing?.recurring ?? false);
  const [shake, setShake] = useState(0);
  const [labelFocused, setLabelFocused] = useState(false);
  // Une opération existante s'ouvre directement sur ses détails ; une nouvelle commence par le montant.
  const [step, setStep] = useState<'amount' | 'details'>(existing ? 'details' : 'amount');

  const income = kind === 'income';
  const today = todayString();
  const yesterday = todayString(new Date(Date.now() - 86_400_000));

  // Mémoire des libellés : retaper « Car… » propose « Carrefour » avec sa catégorie et son enveloppe.
  const suggestions = useMemo(() => {
    const q = label.trim().toLowerCase();
    if (!labelFocused || q.length < 2) return [];
    const pool = (income ? revenus : depenses) as (Revenu | Depense)[];
    const seen = new Set<string>();
    return [...pool]
      .sort((a, b) => compareDateStrings(a.date, b.date))
      .filter((r) => {
        const key = r.label.toLowerCase();
        if (!key.startsWith(q) || key === q || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [label, labelFocused, income, revenus, depenses]);

  function applySuggestion(r: Revenu | Depense) {
    haptic.select();
    setLabel(r.label);
    setCategory(r.category);
    if (income) setIncomeType((r as Revenu).type);
    else setEnvelopeId((r as Depense).envelope_id);
    if (!amount) setAmount(inputFromAmount(r.amount));
    setLabelFocused(false);
  }

  function goDetails() {
    const v = amountFromInput(amount);
    if (!(v > 0) || v >= 1e8) {
      haptic.warn();
      setShake((n) => n + 1);
      return;
    }
    haptic.select();
    setStep('details');
  }

  function switchKind(k: Kind) {
    setKind(k);
    setCategory(k === 'income' ? 'principal' : 'variable');
  }

  function submit() {
    const value = amountFromInput(amount);
    if (!(value > 0) || value >= 1e8) {
      haptic.warn();
      setShake((n) => n + 1);
      return;
    }
    const finalLabel = label.trim() || (income ? t(`tx.type.${incomeType}`) : t('tx.defaultExpenseLabel'));
    const groupId = existing?.recurring_group_id ?? (recurring ? randomUUID() : null);
    const base = { label: finalLabel, amount: value, date, recurring, recurring_group_id: groupId };

    // Changer le type d'une opération existante = la déplacer d'une table à l'autre.
    if (existing && kind !== initialKind) remove(initialKind === 'income' ? 'revenus' : 'depenses', existing.id);
    const id = existing && kind === initialKind ? existing.id : undefined;
    if (income) save('revenus', { ...base, id, category: category as Revenu['category'], type: incomeType });
    else save('depenses', { ...base, id, category: category as Depense['category'], envelope_id: envelopeId });

    haptic.success();
    toast({ message: existing ? t('tx.updated') : income ? t('tx.incomeAdded') : t('tx.expenseAdded') });
    router.back();
  }

  function onDelete() {
    if (!existing) return;
    const store = initialKind === 'income' ? 'revenus' : 'depenses';
    if (existing.recurring) {
      Alert.alert(t('tx.deleteRecurringTitle'), t('tx.deleteRecurringBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('tx.stopRecurring'),
          onPress: () => {
            stopSeries(store, existing.id, existing.recurring_group_id);
            toast({ message: t('tx.recurrenceStopped') });
            router.back();
          },
        },
        {
          text: t('tx.deleteOne'),
          style: 'destructive',
          onPress: () => {
            deleteTx(store, existing);
            router.back();
          },
        },
      ]);
    } else {
      deleteTx(store, existing);
      router.back();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md }}>
        <IconButton icon="close" label={t('common.close')} onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <Segmented<Kind> value={kind} onChange={switchKind} options={[{ value: 'expense', label: t('tx.expense') }, { value: 'income', label: t('tx.income') }]} />
        </View>
        {existing ? <IconButton icon="delete-outline" color={c.error} label={t('common.delete')} onPress={onDelete} /> : <View style={{ width: 42 }} />}
      </View>

      {step === 'amount' ? (
        <>
          <View style={[column, { flex: 1, justifyContent: 'center', gap: space.md }]}>
            <AmountDisplay value={amount} symbol={symbol} color={income ? c.success : c.text} shakeKey={shake} />
            <Text variant="bodyRegular" muted style={{ textAlign: 'center' }}>{t('tx.amountHint')}</Text>
          </View>
          <View style={[column, { paddingTop: space.sm, paddingBottom: insets.bottom + space.md, gap: short ? space.sm : space.md }]}>
            <Keypad decimals={decimals} onKey={(k) => setAmount((a) => applyKey(a, k, decimals))} />
            <Button title={t('tx.continue')} onPress={goDetails} />
          </View>
        </>
      ) : (
        <>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[column, { paddingVertical: short ? space.md : space.lg, gap: space.xl }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('tx.editAmount')}
              onPress={() => setStep('amount')}
              scaleTo={0.97}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: space.sm }}
            >
              <Text variant="display" color={income ? c.success : c.text} style={{ fontVariant: ['tabular-nums'] }}>
                {amount || '0'} {symbol}
              </Text>
              <Icon name="edit" size={20} color={c.textMuted} />
            </PressableScale>

          <View>
            <TextInput
              value={label}
              onChangeText={setLabel}
              onFocus={() => setLabelFocused(true)}
              onBlur={() => setTimeout(() => setLabelFocused(false), 150)}
              placeholder={income ? t('tx.labelIncomeHint') : t('tx.labelExpenseHint')}
              placeholderTextColor={c.textMuted}
              selectionColor={c.primary}
              accessibilityLabel={t('tx.label')}
              returnKeyType="done"
              style={{ fontFamily: font.displaySemi, fontSize: 22, color: c.text, textAlign: 'center', paddingVertical: space.sm, borderBottomWidth: 1.5, borderBottomColor: labelFocused ? c.primary : c.outlineVariant }}
            />
            {suggestions.length > 0 ? (
              <Animated.View entering={FadeIn.duration(150)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <Chip key={s.id} icon="history" label={s.label} onPress={() => applySuggestion(s)} />
                ))}
              </Animated.View>
            ) : null}
          </View>
  
          <Group title={t('tx.date')}>
            <DateStrip value={date} onChange={setDate} />
          </Group>
  
          {income ? (
            <Group title={t('tx.incomeType')}>
              <TileGrid value={incomeType} onChange={setIncomeType} options={INCOME_TYPES.map((o) => ({ ...o, label: t(`tx.type.${o.key}`) }))} />
            </Group>
          ) : envelopes.length > 0 ? (
            <Group title={t('tx.envelope')}>
              <TileGrid
                value={envelopeId ?? 'none'}
                onChange={(k) => setEnvelopeId(k === 'none' ? null : k)}
                options={[
                  ...envelopes.map((e) => ({ key: e.id, label: e.name, icon: e.icon, color: envelopeColor(e.color) })),
                  { key: 'none', label: t('tx.noEnvelope'), icon: 'block', color: c.textMuted },
                ]}
              />
            </Group>
          ) : null}
  
          <Group title={t('tx.category')}>
            {income ? (
              <OptionCards
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'principal', title: t('tx.cat.principal'), hint: t('tx.cat.principalHint'), icon: 'star-outline' },
                  { value: 'secondaire', title: t('tx.cat.secondaire'), hint: t('tx.cat.secondaireHint'), icon: 'add-circle-outline' },
                ]}
              />
            ) : (
              <OptionCards
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'variable', title: t('tx.cat.variable'), hint: t('tx.cat.variableHint'), icon: 'shuffle' },
                  { value: 'fixe', title: t('tx.cat.fixe'), hint: t('tx.cat.fixeHint'), icon: 'push-pin' },
                ]}
              />
            )}
          </Group>
  
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: recurring ? c.primaryFixed : c.card, borderRadius: radius.md, padding: space.md, borderWidth: 1.5, borderColor: recurring ? c.primary : 'transparent' }}>
            <IconTile icon="autorenew" color={recurring ? c.primary : c.textMuted} size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="body">{t('tx.recurring')}</Text>
              <Text variant="caption" muted>{t('tx.recurringHint')}</Text>
            </View>
            <Switch
              value={recurring}
              onValueChange={(v) => {
                haptic.select();
                setRecurring(v);
              }}
              trackColor={{ true: c.primary, false: c.outline }}
              thumbColor="#fff"
              accessibilityLabel={t('tx.recurring')}
            />
          </View>
            </ScrollView>

          <View style={[column, { paddingTop: space.sm, paddingBottom: insets.bottom + space.md }]}>
            <Button title={existing ? t('common.save') : income ? t('tx.addIncome') : t('tx.addExpense')} onPress={submit} />
          </View>
        </>
      )}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" muted>{title}</Text>
      {children}
    </View>
  );
}

/** « Arrêter la récurrence » : les occurrences passées restent, plus aucune n'est générée. */
function stopSeries(store: 'revenus' | 'depenses', id: string, groupId: string | null) {
  const inSeries = (r: { id: string; recurring: boolean; recurring_group_id: string | null }) =>
    r.recurring && (r.id === id || (groupId !== null && r.recurring_group_id === groupId));
  if (store === 'revenus') saveMany('revenus', listAll('revenus').filter(inSeries).map((r) => ({ ...r, recurring: false })));
  else saveMany('depenses', listAll('depenses').filter(inSeries).map((r) => ({ ...r, recurring: false })));
}
