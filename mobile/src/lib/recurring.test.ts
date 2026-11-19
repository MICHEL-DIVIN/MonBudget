import { describe, expect, it } from 'vitest';
import { occurrenceId, planRecurring, type RecurringRow } from './recurring';

const G = '11111111-1111-4111-8111-111111111111';

function row(over: Partial<RecurringRow> & { id: string; date: string }): RecurringRow {
  return { label: 'Loyer', amount: 500, recurring: true, recurring_group_id: G, deleted: false, ...over };
}

describe('planRecurring', () => {
  it('génère les mois manquants jusqu’au mois courant', () => {
    const plan = planRecurring([row({ id: 'a', date: '2026-01-05' })], new Date(2026, 3, 20));
    expect(plan.create.map((c) => c.date)).toEqual(['2026-02-05', '2026-03-05', '2026-04-05']);
  });

  it('ne génère pas une occurrence dont la date est dans le futur', () => {
    const plan = planRecurring([row({ id: 'a', date: '2026-01-25' })], new Date(2026, 1, 10));
    expect(plan.create).toHaveLength(0);
  });

  it('ramène le jour au dernier jour du mois (31 → 28/29)', () => {
    const plan = planRecurring([row({ id: 'a', date: '2026-01-31' })], new Date(2026, 2, 31));
    expect(plan.create.map((c) => c.date)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('identifiants déterministes : deux appareils produisent les mêmes ids', () => {
    const a = planRecurring([row({ id: 'a', date: '2026-01-05' })], new Date(2026, 2, 20));
    const b = planRecurring([row({ id: 'a', date: '2026-01-05' })], new Date(2026, 2, 21));
    expect(a.create.map((c) => c.id)).toEqual(b.create.map((c) => c.id));
    expect(a.create[0].id).toBe(occurrenceId(G, 2026, 1));
  });

  it('ne recrée pas une occurrence supprimée par l’utilisateur', () => {
    const feb = occurrenceId(G, 2026, 1);
    const plan = planRecurring(
      [row({ id: 'a', date: '2026-01-05' }), row({ id: feb, date: '2026-02-05', deleted: true })],
      new Date(2026, 2, 20),
    );
    expect(plan.create.map((c) => c.date)).toEqual(['2026-03-05']);
  });

  it('ne ressuscite pas une occurrence d’origine supprimée', () => {
    const plan = planRecurring(
      [row({ id: 'orig', date: '2026-01-05', deleted: true }), row({ id: 'b', date: '2026-02-05' })],
      new Date(2026, 2, 20),
    );
    expect(plan.create.map((c) => c.date)).toEqual(['2026-03-05']);
  });

  it('ne génère rien si le mois existe déjà', () => {
    const plan = planRecurring(
      [row({ id: 'a', date: '2026-01-05' }), row({ id: 'b', date: '2026-02-10' })],
      new Date(2026, 1, 20),
    );
    expect(plan.create).toHaveLength(0);
  });

  it('utilise le dernier élément comme modèle (montant mis à jour)', () => {
    const plan = planRecurring(
      [row({ id: 'a', date: '2026-01-05', amount: 500 }), row({ id: 'b', date: '2026-02-05', amount: 550 })],
      new Date(2026, 2, 20),
    );
    expect(plan.create[0].template.amount).toBe(550);
  });

  it('rattache les séries historiques sans groupe à un groupe stable', () => {
    const legacy = row({ id: 'a', date: '2026-01-05', recurring_group_id: null });
    const p1 = planRecurring([legacy], new Date(2026, 1, 20));
    const p2 = planRecurring([legacy], new Date(2026, 1, 25));
    expect(p1.assignGroups).toHaveLength(1);
    expect(p1.assignGroups[0].groupId).toBe(p2.assignGroups[0].groupId);
    expect(p1.create).toHaveLength(1);
  });

  it('ignore les éléments non récurrents', () => {
    const plan = planRecurring([row({ id: 'a', date: '2026-01-05', recurring: false })], new Date(2026, 5, 1));
    expect(plan.create).toHaveLength(0);
  });
});
