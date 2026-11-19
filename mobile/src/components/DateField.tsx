import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { formatLocalDate, toLocalDate } from '@/lib/dates';
import { formatFullDate } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { radius, space, Text } from './ui';

/** Sélecteur de date (AAAA-MM-JJ) natif : boîte de dialogue sur Android, roue intégrée sur iOS. */
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { c, scheme } = useTheme();
  const { intl } = useI18n();
  const [iosOpen, setIosOpen] = useState(false);
  const date = toLocalDate(value);

  const apply = (d?: Date) => {
    if (d) onChange(formatLocalDate(d.getFullYear(), d.getMonth(), d.getDate()));
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: date, mode: 'date', onChange: (_e, d) => apply(d) });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label" muted>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatFullDate(value, intl)}`}
        onPress={open}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.cardHigh, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14 }}
      >
        <Text variant="body">{formatFullDate(value, intl)}</Text>
        <Icon name="event" size={20} color={c.textMuted} />
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <DateTimePicker value={date} mode="date" display="inline" themeVariant={scheme} onChange={(_e, d) => apply(d)} />
      ) : null}
    </View>
  );
}
