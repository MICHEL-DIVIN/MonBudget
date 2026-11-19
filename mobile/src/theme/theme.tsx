import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getMeta, setMeta } from '@/lib/db';

/**
 * Identité « billet de banque » : encre et papier, un seul accent laiton.
 * Vert monnaie pour les entrées, corail pour les sorties.
 */
const dark = {
  background: '#0F1626', // encre
  card: '#172034',
  cardHigh: '#1F2A42',
  cardHighest: '#2A3654',
  outline: '#34405E',
  outlineVariant: '#222D45',
  text: '#EEF0E8', // papier
  textMuted: '#93A0B8',
  primary: '#E2B356', // laiton
  onPrimary: '#1A1405',
  primaryFixed: '#2B2A22',
  success: '#4CC795',
  error: '#F0725C',
  errorContainer: '#3A2129',
  warning: '#F2A93B',
  overlay: 'rgba(5,9,18,0.7)',
  guilloche: 'rgba(226,179,86,0.16)',
};

const light: typeof dark = {
  background: '#EDF0EA', // papier
  card: '#F8FAF5',
  cardHigh: '#E1E7DD',
  cardHighest: '#D3DBCF',
  outline: '#BCC6B8',
  outlineVariant: '#D6DDD2',
  text: '#142033', // encre
  textMuted: '#556074',
  primary: '#9A6B12',
  onPrimary: '#FFFFFF',
  primaryFixed: '#F1E6CC',
  success: '#1E8A5C',
  error: '#C2412D',
  errorContainer: '#F6DCD5',
  warning: '#A86A0B',
  overlay: 'rgba(20,32,51,0.4)',
  guilloche: 'rgba(154,107,18,0.14)',
};

export type Colors = typeof dark;
export type ThemeMode = 'system' | 'light' | 'dark';

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displaySemi: 'BricolageGrotesque_600SemiBold',
  displayRegular: 'BricolageGrotesque_400Regular',
  body: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

/** Ressorts partagés : une seule « physique » pour toute l'app. */
export const motion = {
  press: { damping: 15, stiffness: 320, mass: 0.6 },
  settle: { damping: 20, stiffness: 180, mass: 0.9 },
  fill: 700,
};

/** Couleurs des enveloppes (la base stocke des noms de classes hérités de l'app web). */
export const ENVELOPE_COLORS: Record<string, string> = {
  'bg-env-green': '#3FB98A',
  'bg-env-blue': '#4F9BE0',
  'bg-env-yellow': '#E0A93A',
  'bg-env-pink': '#E0789B',
  'bg-env-orange': '#E9874B',
  'bg-env-purple': '#9586EC',
  'bg-primary-fixed': '#5C7FE0',
  'bg-error-container': '#DC5D6E',
  'bg-tertiary-fixed': '#C98A3E',
  'bg-secondary-fixed': '#6E78D8',
};

export const envelopeColor = (key: string) => ENVELOPE_COLORS[key] ?? '#9586EC';

interface ThemeValue {
  c: Colors;
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue>({ c: dark, scheme: 'dark', mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = getMeta('pref.theme');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setMeta('pref.theme', m);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode;
    return { c: scheme === 'dark' ? dark : light, scheme, mode, setMode };
  }, [mode, system, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
