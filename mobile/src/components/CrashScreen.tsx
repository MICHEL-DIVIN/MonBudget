import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { reportError } from '@/lib/monitoring';
import { Mascot } from './Mascot';

/**
 * Écran affiché si une erreur inattendue casse l'affichage. Il est rendu EN DEHORS des providers
 * (thème, langue…) : couleurs et textes sont donc fixes, en français et en anglais.
 */
export function CrashScreen({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportError(error, { area: 'render' });
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0F1626', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Mascot pose="hold" prop="wrench-outline" propColor="#F0725C" size={0.8} />
      <Text style={{ fontFamily: 'BricolageGrotesque_700Bold', fontSize: 26, color: '#EEF0E8', textAlign: 'center' }}>Oups, quelque chose a coincé</Text>
      <Text style={{ fontFamily: 'Figtree_400Regular', fontSize: 15, lineHeight: 22, color: '#93A0B8', textAlign: 'center', maxWidth: 320 }}>
        Vos données sont en sécurité sur le téléphone. L’erreur a été signalée à l’équipe.{'\n'}Something went wrong — your data is safe.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={({ pressed }) => ({ marginTop: 8, backgroundColor: '#E2B356', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, opacity: pressed ? 0.85 : 1 })}
      >
        <Text style={{ fontFamily: 'Figtree_600SemiBold', fontSize: 16, color: '#1A1405' }}>Réessayer</Text>
      </Pressable>
    </View>
  );
}
