import { listWithDeleted, save, saveMany } from './repo';
import { planRecurring, type RecurringRow } from './recurring';
import type { Depense, Revenu } from './types';

/** Génère les occurrences récurrentes manquantes dans la base locale. Retourne le nombre de créations. */
export function generateRecurring(now = new Date()): number {
  let created = 0;

  const revenus = listWithDeleted('revenus');
  const planR = planRecurring<Revenu & RecurringRow>(revenus, now);
  for (const a of planR.assignGroups) {
    const r = revenus.find((x) => x.id === a.id);
    if (r) {
      const { deleted: _d, ...rest } = r;
      save('revenus', { ...rest, recurring_group_id: a.groupId });
    }
  }
  saveMany(
    'revenus',
    planR.create.map(({ template: t, id, date, groupId }) => ({
      id,
      label: t.label,
      amount: t.amount,
      category: t.category,
      type: t.type,
      date,
      recurring: true,
      recurring_group_id: groupId,
    })),
  );
  created += planR.create.length;

  const depenses = listWithDeleted('depenses');
  const planD = planRecurring<Depense & RecurringRow>(depenses, now);
  for (const a of planD.assignGroups) {
    const d = depenses.find((x) => x.id === a.id);
    if (d) {
      const { deleted: _d, ...rest } = d;
      save('depenses', { ...rest, recurring_group_id: a.groupId });
    }
  }
  saveMany(
    'depenses',
    planD.create.map(({ template: t, id, date, groupId }) => ({
      id,
      label: t.label,
      amount: t.amount,
      category: t.category,
      envelope_id: t.envelope_id,
      date,
      recurring: true,
      recurring_group_id: groupId,
    })),
  );
  created += planD.create.length;

  return created;
}
