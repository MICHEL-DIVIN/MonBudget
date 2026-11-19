import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { Mascot } from './Mascot';
import { Guilloche } from './motion';
import { IconButton, space, Text } from './ui';

/** Cadre des écrans de connexion : bandeau guilloché avec Sou qui salue, puis le formulaire. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 200 + insets.top, paddingTop: insets.top, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: insets.top + 30, left: 0 }}>
            <Guilloche width={w} height={150} color={c.guilloche} lines={16} />
          </View>
          <View style={{ paddingHorizontal: space.md, height: 48, justifyContent: 'center' }}>
            {router.canGoBack() ? <IconButton icon="arrow-back" label="Retour" onPress={() => router.back()} /> : null}
          </View>
          <View style={{ position: 'absolute', right: space.lg, bottom: -8 }}>
            <Mascot pose="wave" size={0.62} />
          </View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: space.xl, gap: space.xl, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          <View style={{ gap: space.xs }}>
            <Text variant="display">{title}</Text>
            {subtitle ? <Text variant="bodyRegular" muted>{subtitle}</Text> : null}
          </View>
          <View style={{ gap: space.lg }}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
