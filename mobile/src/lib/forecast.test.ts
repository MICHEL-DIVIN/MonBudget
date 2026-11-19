import { describe, expect, it } from 'vitest';
import { monthForecast, upcomingBetween, upcomingRecurring } from './forecast';
import type { RecurringRow } from './recurring';

const G1 = '11111111-1111-4111-8111-111111111111';
const G2 = '22222222-2222-4222-8222-222222222222';
const row = (o: Partial<RecurringRow> & { id: string; date: string }): RecurringRow => ({
  label: 'x', amount: 100, recurring: true, recurring_group_id: G1, deleted: false, ...o,
});

describe('upcomingRecurring', () => {
  const now = new Date(2026, 10, 15); // 15 novembre

  it('liste les récurrences du mois dont la date n’est pas encore arrivée', () => {
    const dep = [row({ id: 'loyer', label: 'Loyer', amount: 700, date: '2026-10-28' })];
    const rev = [row({ id: 'sal', label: 'Salaire', amount: 2500, date: '2026-10-30', recurring_group_id: G2 })];
    const up = upcomingRecurring(rev, dep, now);
    expect(up).toEqual([
      expect.objectContaining({ label: 'Loyer', amount: 700, date: '2026-11-28', kind: 'expense' }),
      expect.objectContaining({ label: 'Salaire', amount: 2500, date: '2026-11-30', kind: 'income' }),
    ]);
  });

  it('ignore une échéance déjà passée ce mois (elle est déjà générée)', () => {
    const dep = [row({ id: 'a', date: '2026-10-05' }), row({ id: 'b', date: '2026-11-05' })];
    expect(upcomingRecurring([], dep, now)).toEqual([]);
  });

  it('ignore une échéance du mois que l’utilisateur a supprimée', () => {
    const dep = [row({ id: 'a', date: '2026-10-28' }), row({ id: 'b', date: '2026-11-28', deleted: true })];
    expect(upcomingRecurring([], dep, now)).toEqual([]);
  });

  it('ignore les opérations non récurrentes', () => {
    expect(upcomingRecurring([], [row({ id: 'a', date: '2026-10-28', recurring: false })], now)).toEqual([]);
  });
});

describe('upcomingBetween', () => {
  it('liste aussi les échéances du mois suivant (rappels la veille)', () => {
    const dep = [row({ id: 'loyer', label: 'Loyer', amount: 700, date: '2026-10-05' })];
    const up = upcomingBetween([], dep, new Date(2026, 10, 15), new Date(2026, 11, 31));
    expect(up.map((u) => u.date)).toEqual(['2026-12-05']);
  });
});

describe('monthForecast', () => {
  it('déduit les échéances à venir et répartit sur les jours restants (aujourd’hui compris)', () => {
    const f = monthForecast(2000, 500, [
      { id: '1', label: 'Loyer', amount: 700, date: '2026-11-28', kind: 'expense' },
      { id: '2', label: 'Prime', amount: 100, date: '2026-11-29', kind: 'income' },
    ], new Date(2026, 10, 21));
    expect(f.leftToSpend).toBe(900);
    expect(f.daysLeft).toBe(10);
    expect(f.perDay).toBe(90);
  });

  it('pas de budget quotidien négatif', () => {
    expect(monthForecast(100, 500, [], new Date(2026, 10, 21)).perDay).toBe(0);
  });
});
