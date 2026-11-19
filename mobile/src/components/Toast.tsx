import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/theme';
import { Icon } from './Icon';
import { radius, space, Text } from './ui';

interface ToastInput {
  message: string;
  icon?: string;
  action?: { label: string; onPress: () => void };
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Confirmation éphémère d'une action, avec un éventuel « Annuler ». */
export const useToast = () => useContext(ToastContext);

const DURATION = 4500;
/** Hauteur de la barre d'onglets : le toast s'affiche au-dessus. */
export const TAB_BAR_HEIGHT = 66;

export function ToastProvider({ children }: { children: ReactNode }) {
  const { c, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), DURATION);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: Math.max(insets.bottom, 12) + TAB_BAR_HEIGHT + space.lg }}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOutDown.duration(180)}
            layout={LinearTransition}
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.text, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: space.lg }}
          >
            <Icon name={toast.icon ?? 'check-circle'} size={20} color={c.background} />
            <Text variant="label" color={c.background} style={{ flex: 1 }}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  toast.action!.onPress();
                  setToast(null);
                }}
              >
                <Text variant="label" color={scheme === 'dark' ? '#9A6B12' : '#E2B356'}>
                  {toast.action.label}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}
