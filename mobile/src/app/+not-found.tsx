import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/theme/theme';

/**
 * Adresse sans écran correspondant. Cas courant : au premier lancement, l'app s'ouvre sur « / »
 * (l'accueil), réservé aux comptes connectés. Plutôt que l'écran « Unmatched Route », on redirige :
 * vers la bienvenue si personne n'est connecté, vers l'accueil sinon. Couvre aussi la déconnexion
 * et les liens (notifications, liens profonds) vers une page qui n'existe pas ou plus.
 */
export default function NotFound() {
  const { status, expired } = useAuth();
  const { c } = useTheme();
  const signedIn = status === 'signedIn' && !expired;
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Redirect href={signedIn ? '/' : '/welcome'} />
    </View>
  );
}
