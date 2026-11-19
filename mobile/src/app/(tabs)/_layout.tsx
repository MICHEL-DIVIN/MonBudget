import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { TabBar } from '@/components/TabBar';
import { getMeta } from '@/lib/db';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/theme/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  const { t } = useI18n();

  // L'assistant ne s'affiche qu'après une inscription : un compte existant qui se connecte
  // sur un nouvel appareil récupère ses données par la synchronisation, sans repasser par l'accueil.
  useEffect(() => {
    if (getMeta('onboarding.pending')) router.push('/onboarding');
  }, []);

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background }, animation: 'shift' }}>
      <Tabs.Screen name="index" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="transactions" options={{ title: t('nav.transactions') }} />
      <Tabs.Screen name="budget" options={{ title: t('nav.budget') }} />
      <Tabs.Screen name="analyse" options={{ title: t('nav.analysis') }} />
    </Tabs>
  );
}
