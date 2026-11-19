import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PinPad } from '@/components/PinPad';
import { space } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { setPin } from '@/lib/pin';
import { useSecurity } from '@/lib/security';
import { useTheme } from '@/theme/theme';

/** Création du code PIN : saisie puis confirmation. */
export default function PinSetupScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { setPinEnabled } = useSecurity();
  const [first, setFirst] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <PinPad
        key={first ? 'confirm' : 'enter'}
        title={first ? t('pin.confirm') : t('pin.setup')}
        subtitle={first ? undefined : t('pin.setupHint')}
        onComplete={async (pin) => {
          if (!first) {
            setFirst(pin);
            return null;
          }
          if (pin !== first) {
            setFirst(null);
            return t('pin.mismatch');
          }
          await setPin(pin);
          setPinEnabled(true);
          router.back();
          return null;
        }}
      />
    </View>
  );
}
