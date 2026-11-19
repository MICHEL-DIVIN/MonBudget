import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Coin, Mascot } from '@/components/Mascot';
import { Button, Chip, Field, radius, Screen, space, Text } from '@/components/ui';
import { CURRENCIES, useCurrency } from '@/lib/currency';
import { setMeta } from '@/lib/db';
import { parseDecimal } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { save } from '@/lib/repo';
import { motion, useTheme } from '@/theme/theme';

const STEPS = ['welcome', 'currency', 'envelopes', 'done'] as const;
type Pose = { pose: 'wave' | 'hold'; prop?: ComponentProps<typeof Mascot>['prop']; color?: string; coin?: boolean };
const POSE: Record<(typeof STEPS)[number], Pose> = {
  welcome: { pose: 'wave' },
  currency: { pose: 'hold', prop: 'cash-multiple', color: '#3FB98A' },
  envelopes: { pose: 'hold', prop: 'email-outline', color: '#E9874B' },
  done: { pose: 'wave', coin: true },
};
const SUGGESTIONS = [
  { key: 'groceries', icon: 'shopping_cart', color: 'bg-env-green' },
  { key: 'leisure', icon: 'sports_esports', color: 'bg-env-orange' },
  { key: 'transport', icon: 'directions_car', color: 'bg-env-blue' },
  { key: 'gifts', icon: 'redeem', color: 'bg-env-pink' },
] as const;

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => ({ width: withSpring(active ? 28 : 8, motion.settle) }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active || done ? c.primary : c.outline }, style]} />;
}

/** Assistant de démarrage (nouveaux comptes) : devise puis première enveloppe. */
export default function OnboardingScreen() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { currency, setCurrency } = useCurrency();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [suggestion, setSuggestion] = useState<(typeof SUGGESTIONS)[number] | null>(null);
  const key = STEPS[step];

  const finish = () => {
    setMeta('onboarding.pending', null);
    router.replace('/(tabs)');
  };

  function next() {
    if (key === 'envelopes' && name.trim()) {
      const b = parseDecimal(budget || '0');
      save('envelopes', { name: name.trim(), budgeted: b >= 0 ? b : 0, color: suggestion?.color ?? 'bg-env-green', icon: suggestion?.icon ?? 'category', sort_order: 0 });
    }
    if (step === STEPS.length - 1) return finish();
    setStep(step + 1);
  }

  return (
    <Screen
      keyboard
      contentStyle={{ flexGrow: 1, paddingTop: space.xxl }}
      footer={
        <View style={{ gap: space.sm }}>
          <Button title={step === STEPS.length - 1 ? t('onboarding.finish') : key === 'envelopes' && !name.trim() ? t('onboarding.skipStep') : t('onboarding.next')} onPress={next} />
          {step < STEPS.length - 1 ? <Button title={t('onboarding.skip')} variant="ghost" onPress={finish} /> : null}
        </View>
      }
    >
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {STEPS.map((_, i) => <StepDot key={i} active={i === step} done={i < step} />)}
      </View>

      <Animated.View key={key} entering={FadeInRight.springify().damping(20)} exiting={FadeOutLeft.duration(150)} style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'center' }}>
          <Mascot pose={POSE[key].pose} prop={POSE[key].prop} propColor={POSE[key].color} size={0.85} />
          {POSE[key].coin ? <View style={{ marginLeft: -24 }}><Coin size={0.65} /></View> : null}
        </View>
        <Text variant="display">{t(`onboarding.${key}`)}</Text>
        <Text variant="bodyRegular" muted>{t(`onboarding.${key}Desc`)}</Text>

        {key === 'currency' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {CURRENCIES.map((cur) => <Chip key={cur} label={cur} active={currency === cur} onPress={() => setCurrency(cur)} />)}
          </View>
        ) : null}

        {key === 'envelopes' ? (
          <View style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {SUGGESTIONS.map((s) => (
                <Chip
                  key={s.key}
                  label={t(`onboarding.sugg.${s.key}`)}
                  active={suggestion?.key === s.key}
                  onPress={() => {
                    setSuggestion(s);
                    setName(t(`onboarding.sugg.${s.key}`));
                  }}
                />
              ))}
            </View>
            <Field label={t('env.name')} value={name} onChangeText={setName} />
            <Field label={t('env.budget')} value={budget} onChangeText={setBudget} keyboardType="decimal-pad" placeholder="0" />
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}
