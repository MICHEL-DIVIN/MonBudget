import { useCallback } from 'react';
import { haptic } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useI18n } from './i18n';
import { remove, save } from './repo';
import type { Depense, Revenu } from './types';

/**
 * Suppression immédiate (pas de boîte de dialogue) avec « Annuler » dans le toast :
 * plus rapide qu'une confirmation, et sans risque.
 */
export function useDeleteWithUndo() {
  const toast = useToast();
  const { t } = useI18n();
  return useCallback(
    (store: 'revenus' | 'depenses', record: Revenu | Depense) => {
      remove(store, record.id);
      haptic.light();
      toast({
        message: store === 'revenus' ? t('tx.incomeDeleted') : t('tx.expenseDeleted'),
        icon: 'delete-outline',
        action: {
          label: t('common.undo'),
          onPress: () => {
            const { created_at: _c, updated_at: _u, ...rest } = record;
            if (store === 'revenus') save('revenus', rest as Omit<Revenu, 'created_at' | 'updated_at'>);
            else save('depenses', rest as Omit<Depense, 'created_at' | 'updated_at'>);
          },
        },
      });
    },
    [toast, t],
  );
}
