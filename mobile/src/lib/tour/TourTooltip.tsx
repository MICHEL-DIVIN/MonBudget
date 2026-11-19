import { View } from 'react-native';
import { useCopilot, type CopilotProps, type TooltipProps } from 'react-native-copilot';
import { Button, Text, radius, space } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/theme';
import type { TourStepName } from './tourSteps';

/**
 * Bulle de la visite guidée : titre, description, progression (2/5) et boutons Passer / Précédent / Suivant.
 * « Passer » et « Terminer » arrêtent toutes deux le tour (l'écouteur `stop` enregistre alors qu'il a été vu).
 */
export function TourTooltip(_props: TooltipProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const { currentStep, currentStepNumber, totalStepsNumber, isFirstStep, isLastStep, goToNext, goToPrev, stop } = useCopilot();
  if (!currentStep) return null;
  const name = currentStep.name as TourStepName;

  return (
    <View style={{ width: '100%', minWidth: 260, gap: space.md }} accessibilityViewIsModal>
      <View style={{ gap: space.xs }}>
        <Text variant="heading" color={c.text} accessibilityRole="header">
          {t(`tour.${name}.title`)}
        </Text>
        <Text variant="bodyRegular" color={c.textMuted}>
          {t(`tour.${name}.body`)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ flexDirection: 'row', gap: 5 }} accessible accessibilityLabel={t('tour.progress', { n: currentStepNumber, total: totalStepsNumber })}>
          {Array.from({ length: totalStepsNumber }, (_, i) => (
            <View key={i} style={{ width: i + 1 === currentStepNumber ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i + 1 <= currentStepNumber ? c.primary : c.outline }} />
          ))}
        </View>
        <Text variant="caption" color={c.textMuted}>
          {t('tour.progress', { n: currentStepNumber, total: totalStepsNumber })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {!isLastStep ? <Button title={t('tour.skip')} variant="ghost" size="md" onPress={() => void stop()} /> : <View />}
        <View style={{ flex: 1 }} />
        {!isFirstStep ? <Button title={t('tour.prev')} variant="secondary" size="md" onPress={() => void goToPrev()} /> : null}
        <Button title={isLastStep ? t('tour.finish') : t('tour.next')} size="md" onPress={() => void (isLastStep ? stop() : goToNext())} />
      </View>
    </View>
  );
}

/** Aucune pastille numérotée sur la cible : la progression est déjà dans la bulle (2/5). */
export const NoStepNumber = () => null;

interface RawMaskArgs {
  size: { x: { _value: number }; y: { _value: number } };
  position: { x: { _value: number }; y: { _value: number } };
  canvasSize: { x: number; y: number };
}

/** Spotlight aux angles arrondis (un cercle pour le bouton « + ») au lieu d'un rectangle à angles droits. */
export const roundedSpotlight: NonNullable<CopilotProps['svgMaskPath']> = (args) => {
  const { size, position, canvasSize } = args as unknown as RawMaskArgs;
  const x = position.x._value;
  const y = position.y._value;
  const w = size.x._value;
  const h = size.y._value;
  const r = Math.max(0, Math.min(radius.lg, w / 2, h / 2));
  // Rectangle plein écran, puis découpe arrondie (rendu en « evenodd » par la librairie).
  return (
    `M0,0H${canvasSize.x}V${canvasSize.y}H0V0Z` +
    `M${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}` +
    `H${x + r}Q${x},${y + h} ${x},${y + h - r}V${y + r}Q${x},${y} ${x + r},${y}Z`
  );
};
