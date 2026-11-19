import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, EmptyState, Screen, space, Text } from '@/components/ui';
import { parseCsv, type ImportRow } from '@/lib/csv';
import { useCurrency } from '@/lib/currency';
import { useI18n } from '@/lib/i18n';
import { saveMany } from '@/lib/repo';
import { useTheme } from '@/theme/theme';

const PREVIEW_LIMIT = 15;

/** Import CSV : export Mon Budget, relevé bancaire (débit/crédit) ou format simple. Aperçu avant validation. */
export default function ImportScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { formatAmount } = useCurrency();
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');

  async function pick() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    try {
      const asset = res.assets[0];
      const text = await new File(asset.uri).text();
      const parsed = parseCsv(text);
      setFileName(asset.name);
      setRows(parsed);
      if (parsed.length === 0) Alert.alert(t('import.noRows'));
    } catch {
      Alert.alert(t('import.readError'));
    }
  }

  function confirm() {
    if (!rows?.length) return;
    const revenus = rows.filter((r) => r.type === 'revenu');
    const depenses = rows.filter((r) => r.type === 'depense');
    saveMany(
      'revenus',
      revenus.map((r) => ({ label: r.label, amount: r.amount, category: r.category === 'principal' ? ('principal' as const) : ('secondaire' as const), type: 'autre', date: r.date, recurring: false, recurring_group_id: null })),
    );
    saveMany(
      'depenses',
      depenses.map((r) => ({ label: r.label, amount: r.amount, category: r.category === 'fixe' ? ('fixe' as const) : ('variable' as const), envelope_id: null, date: r.date, recurring: false, recurring_group_id: null })),
    );
    Alert.alert(t('import.done', { n: rows.length }));
    router.back();
  }

  return (
    <Screen footer={rows?.length ? <Button title={t('import.confirm', { n: rows.length })} onPress={confirm} /> : undefined}>
      <Text variant="caption" muted>{t('import.formats')}</Text>
      <Button title={fileName ? t('import.chooseOther') : t('import.choose')} icon="upload-file" variant="secondary" onPress={pick} />

      {rows === null ? <EmptyState icon="description" title={t('import.empty')} /> : null}
      {rows && rows.length > 0 ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="label" muted>{fileName} — {t('import.preview', { n: rows.length })}</Text>
          {rows.slice(0, PREVIEW_LIMIT).map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 }}>
              <Text variant="caption" muted style={{ width: 76 }}>{r.date}</Text>
              <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>{r.label}</Text>
              <Text variant="label" color={r.type === 'revenu' ? c.success : c.text}>{r.type === 'revenu' ? '+' : '−'}{formatAmount(r.amount)}</Text>
            </View>
          ))}
          {rows.length > PREVIEW_LIMIT ? <Text variant="caption" muted>{t('import.more', { n: rows.length - PREVIEW_LIMIT })}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}
