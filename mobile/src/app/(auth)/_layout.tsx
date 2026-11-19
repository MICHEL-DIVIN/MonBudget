import { Stack } from 'expo-router';
import { useTheme } from '@/theme/theme';

// Premier écran hors connexion : la présentation de l'app.
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
