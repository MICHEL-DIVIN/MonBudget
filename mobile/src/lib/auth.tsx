import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getRefreshToken, loadTokens, setSessionExpiredHandler, setTokens } from './api';
import { getJsonMeta, getMeta, setJsonMeta, setMeta, wipeUserData } from './db';
import { dataChanged } from './events';
import { pendingCount } from './repo';
import { generateRecurring } from './recurring-runner';
import { setMonitoringUser } from './monitoring';
import { refreshPending, syncNow } from './sync';
import type { Profile } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: Profile;
}

interface AuthValue {
  status: Status;
  user: Profile | null;
  /** La session a expiré (refresh refusé) : les données locales sont conservées, il faut se reconnecter. */
  expired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  /** Déconnexion : efface les données locales. Retourne false si des modifications non synchronisées existent et que `force` n'est pas fourni. */
  signOut: (opts?: { force?: boolean }) => Promise<boolean>;
  updateProfile: (patch: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => Promise<void>;
  deleteAccount: (password?: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const PROFILE_KEY = 'user.profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<Profile | null>(null);
  const [expired, setExpired] = useState(false);

  const adopt = useCallback((profile: Profile) => {
    // Autre compte que celui dont les données sont en base : on repart de zéro pour ne jamais mélanger deux utilisateurs.
    if (getMeta('user.id') && getMeta('user.id') !== profile.id) {
      wipeUserData();
      dataChanged.emit();
    }
    setMeta('user.id', profile.id);
    setMonitoringUser(profile.id);
    setJsonMeta(PROFILE_KEY, profile);
    setUser(profile);
    setStatus('signedIn');
    setExpired(false);
  }, []);

  // Démarrage : on ouvre l'app tout de suite avec le profil en cache (fonctionne hors ligne), puis on actualise.
  useEffect(() => {
    setSessionExpiredHandler(() => setExpired(true));
    (async () => {
      const hasSession = await loadTokens();
      const cached = getJsonMeta<Profile | null>(PROFILE_KEY, null);
      if (hasSession && cached) {
        setMonitoringUser(cached.id);
        setUser(cached);
        setStatus('signedIn');
        generateRecurring();
        refreshPending();
        api.get<Profile>('/me').then((p) => adopt(p)).catch(() => {});
        void syncNow();
      } else {
        setStatus('signedOut');
        // Session expirée mais données conservées : on propose de se reconnecter.
        setExpired(!!cached);
      }
    })();
  }, [adopt]);

  const complete = useCallback(
    async (res: AuthResponse) => {
      await setTokens({ access: res.access_token, refresh: res.refresh_token });
      adopt(res.user);
      void syncNow();
    },
    [adopt],
  );

  const login = useCallback(
    async (email: string, password: string) => complete(await api.post<AuthResponse>('/auth/login', { email, password }, { auth: false })),
    [complete],
  );

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      const res = await api.post<AuthResponse>('/auth/register', { email, password, full_name: fullName }, { auth: false });
      setMeta('onboarding.pending', '1'); // nouveau compte : on propose l'assistant de démarrage
      await complete(res);
    },
    [complete],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => complete(await api.post<AuthResponse>('/auth/google', { id_token: idToken }, { auth: false })),
    [complete],
  );

  const signOut = useCallback(async (opts?: { force?: boolean }) => {
    // Dernière tentative d'envoi pour ne perdre aucune saisie.
    if (pendingCount() > 0) await syncNow();
    if (pendingCount() > 0 && !opts?.force) return false;

    const refresh = getRefreshToken();
    if (refresh) await api.post('/auth/logout', { refresh_token: refresh }, { auth: false }).catch(() => {});
    await setTokens(null);
    wipeUserData();
    setMeta('user.id', null);
    setMonitoringUser(null);
    dataChanged.emit();
    setUser(null);
    setExpired(false);
    setStatus('signedOut');
    return true;
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'full_name' | 'avatar_url'>>) => {
      adopt(await api.patch<Profile>('/me', patch));
    },
    [adopt],
  );

  const deleteAccount = useCallback(
    async (password?: string) => {
      await api.delete('/me', password ? { password } : {});
      await setTokens(null);
      wipeUserData();
      setMeta('user.id', null);
      dataChanged.emit();
      setUser(null);
      setStatus('signedOut');
    },
    [],
  );

  const value = useMemo<AuthValue>(
    () => ({ status, user, expired, login, register, loginWithGoogle, signOut, updateProfile, deleteAccount }),
    [status, user, expired, login, register, loginWithGoogle, signOut, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return v;
}
