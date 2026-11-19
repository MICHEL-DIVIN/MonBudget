import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { CopilotStep, walkthroughable } from 'react-native-copilot';
import { useI18n } from '@/lib/i18n';
import { tourStep, type TourStepName } from './tourSteps';

const WalkthroughView = walkthroughable(View);

/**
 * Désigne un élément à mettre en lumière pendant la visite guidée.
 * `active={false}` le retire du tour (ex. un élément absent de l'écran) : le tour ne démarre alors pas
 * tant que toutes ses cibles ne sont pas rendues, donc jamais de cible manquante.
 */
export function TourTarget({ step, children, style, active = true }: { step: TourStepName; children: ReactNode; style?: StyleProp<ViewStyle>; active?: boolean }) {
  const { t } = useI18n();
  const def = tourStep(step);
  return (
    <CopilotStep name={def.name} order={def.order} text={t(`tour.${def.name}.body`)} active={active}>
      <WalkthroughView style={style}>{children}</WalkthroughView>
    </CopilotStep>
  );
}
