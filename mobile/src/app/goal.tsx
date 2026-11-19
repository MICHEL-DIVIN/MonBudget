import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { DateField } from '@/components/DateField';
import { Button, Field, Screen, Text } from '@/components/ui';
import { useCurrency } from '@/lib/currency';
import { parseDecimal, todayString } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { getById, remove, save } from '@/lib/repo';
import { useTheme } from '@/theme/theme';

/** Création / modification d'un objectif d'épargne (`id` = édition). */
export default function GoalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { c } = useTheme();
  const { t } = useI18n();
  const { symbol } = useCurrency();
  const existing = id ? getById('objectifs', id) : null;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [target, setTarget] = useState(existing ? String(existing.target_amount).replace('.', ',') : '');
  const [current, setCurrent] = useState(existing ? String(existing.current_amount).replace('.', ',') : '0');
  const [deadline, setDeadline] = useState<string | null>(existing?.deadline ?? null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const tv = parseDecimal(target);
    const cv = parseDecimal(current || '0');
    if (!label.trim()) return setError(t('tx.labelRequired'));
    if (!(tv > 0)) return setError(t('goal.targetInvalid'));
    if (!(cv >= 0)) return setError(t('tx.amountInvalid'));
    save('objectifs', {
      id: existing?.id,
      label: label.trim(),
      target_amount: Math.round(tv * 100) / 100,
      current_amount: Math.round(cv * 100) / 100,
      deadline,
    });
    router.back();
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert(t('goal.deleteTitle'), t('goal.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          remove('objectifs', existing.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen keyboard footer={<Button title={t('common.save')} onPress={submit} />}>
      <Stack.Screen options={{ title: existing ? t('goal.edit') : t('goal.new') }} />
      <Field label={t('goal.name')} value={label} onChangeText={setLabel} placeholder={t('goal.nameHint')} autoFocus={!existing} />
      <Field label={`${t('goal.target')} (${symbol})`} value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0,00" />
      <Field label={`${t('goal.current')} (${symbol})`} value={current} onChangeText={setCurrent} keyboardType="decimal-pad" placeholder="0,00" />
      {deadline ? (
        <>
          <DateField label={t('goal.deadline')} value={deadline} onChange={setDeadline} />
          <Button title={t('goal.removeDeadline')} variant="ghost" onPress={() => setDeadline(null)} />
        </>
      ) : (
        <Button title={t('goal.addDeadline')} variant="secondary" icon="event" onPress={() => setDeadline(todayString())} />
      )}
      {error ? <Text variant="label" color={c.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      {existing ? <Button title={t('common.delete')} variant="danger" icon="delete-outline" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
