// Imports par graisse : seules les 7 polices utilisées sont embarquées dans l'app.
import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CrashScreen } from '@/components/CrashScreen';
import { ToastProvider } from '@/components/Toast';
import { wakeServer } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CurrencyProvider } from '@/lib/currency';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { initMonitoring, navigationIntegration, wrapRoot } from '@/lib/monitoring';
import { SecurityProvider } from '@/lib/security';
import { SyncTriggers } from '@/lib/triggers';
import { font, ThemeProvider, useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Le plus tôt possible : capture aussi les erreurs du démarrage.
initMonitoring();

/** Une erreur de rendu affiche un écran de secours (et elle est signalée) au lieu d'un écran blanc. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <CrashScreen error={error} retry={retry} />;
}

export default wrapRoot(RootLayout);

function RootLayout() {
  useEffect(() => wakeServer(), []);
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef) navigationIntegration.registerNavigationContainer(navigationRef);
  }, [navigationRef]);

  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  // En cas d'échec de chargement des polices, on démarre quand même (polices système).
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <CurrencyProvider>
              <AuthProvider>
                <ToastProvider>
                  <SecurityProvider>
                    <Navigation />
                  </SecurityProvider>
                </ToastProvider>
              </AuthProvider>
            </CurrencyProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const { status, expired } = useAuth();
  const { c, scheme } = useTheme();
  const { t } = useI18n();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return null;

  const signedIn = status === 'signedIn' && !expired;
  // Feuilles : carte native sur iOS, glissement depuis le bas sur Android.
  const sheet = { presentation: 'modal' as const, animation: Platform.OS === 'android' ? ('slide_from_bottom' as const) : undefined };

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {signedIn ? <SyncTriggers /> : null}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerTintColor: c.text,
          headerTitleStyle: { fontFamily: font.displaySemi, fontSize: 18 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction" options={{ ...sheet, headerShown: false }} />
          <Stack.Screen name="goal" options={{ ...sheet, title: t('goal.title') }} />
          <Stack.Screen name="contribute" options={{ ...sheet, title: t('goal.addFunds') }} />
          <Stack.Screen name="envelope" options={{ ...sheet, title: t('env.title') }} />
          <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
          <Stack.Screen name="notifications" options={{ title: t('notif.title') }} />
          <Stack.Screen name="import" options={{ title: t('settings.importTx') }} />
          <Stack.Screen name="support" options={{ title: t('support.title') }} />
          <Stack.Screen name="pin-setup" options={{ ...sheet, title: t('settings.pin') }} />
          <Stack.Screen name="change-password" options={{ ...sheet, title: t('settings.changePassword') }} />
          <Stack.Screen name="delete-account" options={{ ...sheet, title: t('settings.deleteAccount') }} />
          <Stack.Screen name="admin" options={{ title: t('admin.title') }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
