import { describe, expect, it } from 'vitest';
import { parseBase, parseDay, parseFields, RecordError, serialize } from './records.js';

const ID = '3f0c2a5e-8f0e-4c63-9a53-0d6f3e8b7a11';
const NOW = new Date('2026-11-19T12:00:00.000Z');

describe('parseBase', () => {
  it('plafonne une horloge client trop en avance', () => {
    const future = new Date(NOW.getTime() + 3_600_000).toISOString();
    expect(parseBase({ id: ID, updated_at: future }, NOW).updatedAt.getTime()).toBe(NOW.getTime());
  });

  it('refuse un id qui n’est pas un UUID', () => {
    expect(() => parseBase({ id: "1'; DROP TABLE users;--" }, NOW)).toThrow(RecordError);
  });
});

describe('parseDay', () => {
  it('accepte une date valide et refuse les dates impossibles', () => {
    expect(parseDay('2026-02-28', 'date').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(() => parseDay('2026-02-30', 'date')).toThrow(RecordError);
    expect(() => parseDay('2026-13-01', 'date')).toThrow(RecordError);
    expect(() => parseDay('hier', 'date')).toThrow(RecordError);
  });
});

describe('parseFields', () => {
  const dep = { label: ' Courses ', amount: 12.345, category: 'variable', date: '2026-11-03' };

  it('nettoie et arrondit une dépense', () => {
    const f = parseFields('depenses', dep);
    expect(f.label).toBe('Courses');
    expect(f.amount).toBe(12.35);
    expect(f.recurring).toBe(false);
    expect(f.envelopeId).toBeNull();
  });

  it.each([
    ['montant négatif', { ...dep, amount: -1 }],
    ['montant nul', { ...dep, amount: 0 }],
    ['montant démesuré', { ...dep, amount: 1e9 }],
    ['montant NaN', { ...dep, amount: 'abc' }],
    ['libellé vide', { ...dep, label: '   ' }],
    ['libellé trop long', { ...dep, label: 'x'.repeat(121) }],
    ['catégorie inconnue', { ...dep, category: 'luxe' }],
    ['envelope_id invalide', { ...dep, envelope_id: 'pas-un-uuid' }],
  ])('refuse : %s', (_name, data) => {
    expect(() => parseFields('depenses', data)).toThrow(RecordError);
  });

  it('refuse une catégorie de revenu invalide', () => {
    expect(() => parseFields('revenus', { label: 'x', amount: 1, category: 'fixe', date: '2026-01-01' })).toThrow(RecordError);
  });

  it('un objectif accepte une échéance nulle', () => {
    const f = parseFields('objectifs', { label: 'Vacances', target_amount: 1000, deadline: null });
    expect(f.deadline).toBeNull();
    expect(f.currentAmount).toBe(0);
  });

  it('une enveloppe a des valeurs par défaut', () => {
    const f = parseFields('envelopes', { name: 'Loisirs' });
    expect(f).toMatchObject({ budgeted: 0, color: 'bg-primary-fixed', icon: 'category', sortOrder: 0 });
  });
});

describe('serialize', () => {
  it('convertit en snake_case avec montants numériques et dates AAAA-MM-JJ', () => {
    const out = serialize('depenses', {
      id: ID,
      userId: 'u',
      label: 'Courses',
      amount: { toString: () => '12.50' },
      category: 'variable',
      envelopeId: null,
      date: new Date('2026-11-03T00:00:00.000Z'),
      recurring: false,
      recurringGroupId: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });
    expect(out).toMatchObject({ id: ID, amount: 12.5, date: '2026-11-03', envelope_id: null, recurring_group_id: null, deleted_at: null });
  });
});
