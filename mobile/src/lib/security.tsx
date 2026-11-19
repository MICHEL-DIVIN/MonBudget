import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinPad } from '@/components/PinPad';
import { space } from '@/components/ui';
import { useTheme } from '@/theme/theme';
import { useAuth } from './auth';
import { useI18n } from './i18n';
import { isPinEnabled, lockoutRemainingMs, verifyPin } from './pin';

/** Délai en arrière-plan avant de reverrouiller. */
const RELOCK_AFTER_MS = 30_000;

interface SecurityValue {
  pinEnabled: boolean;
  /** À appeler après activation / désactivation du PIN (sans verrouiller immédiatement). */
  setPinEnabled: (v: boolean) => void;
  /** L'écran de verrouillage est affiché : rien d'autre ne doit s'ouvrir par-dessus. */
  locked: boolean;
}

const SecurityContext = createContext<SecurityValue>({ pinEnabled: false, setPinEnabled: () => {}, locked: false });

export const useSecurity = () => useContext(SecurityContext);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { t } = useI18n();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [pinEnabled, setPinEnabledState] = useState(false);
  const [locked, setLocked] = useState(true); // verrouillé tant qu'on ne sait pas (pas de flash du contenu)
  const [ready, setReady] = useState(false);
  const [lockout, setLockout] = useState(0);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    isPinEnabled().then((en) => {
      setPinEnabledState(en);
      setLocked(en);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && pinEnabled) {
        if (Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [pinEnabled]);

  // Compte à rebours après trop d'essais.
  useEffect(() => {
    if (!locked) return;
    setLockout(lockoutRemainingMs());
    const id = setInterval(() => setLockout(lockoutRemainingMs()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const setPinEnabled = useCallback((v: boolean) => {
    setPinEnabledState(v);
    if (!v) setLocked(false);
  }, []);

  // Tant qu'on ne sait pas si un PIN existe, on masque le contenu (évite un éclair de données avant le verrou).
  const showLock = status === 'signedIn' && (!ready || (pinEnabled && locked));
  const value = useMemo(() => ({ pinEnabled, setPinEnabled, locked: showLock }), [pinEnabled, setPinEnabled, showLock]);

  return (
    <SecurityContext.Provider value={value}>
      {children}
      {showLock ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, padding: space.xl }}>
          {ready ? (
          <PinPad
            title={t('pin.title')}
            subtitle={lockout > 0 ? t('pin.lockedOut', { s: Math.ceil(lockout / 1000) }) : undefined}
            disabled={lockout > 0}
            onComplete={async (pin) => {
              if (await verifyPin(pin)) {
                setLocked(false);
                return null;
              }
              setLockout(lockoutRemainingMs());
              return t('pin.wrong');
            }}
          />
          ) : null}
        </View>
      ) : null}
    </SecurityContext.Provider>
  );
}
