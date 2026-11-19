import { describe, expect, it } from 'vitest';
import { parseAmount, parseCsv, parseDate, toCsv } from './csv';

describe('parseDate / parseAmount', () => {
  it('convertit JJ/MM/AAAA et AAAA-MM-JJ', () => {
    expect(parseDate('05/03/2026')).toBe('2026-03-05');
    expect(parseDate('5-3-26')).toBe('2026-03-05');
    expect(parseDate('2026-03-05')).toBe('2026-03-05');
  });
  it('lit les montants avec virgule, espaces et symboles', () => {
    expect(parseAmount('1 234,56 €')).toBe(1234.56);
    expect(parseAmount('-42,5')).toBe(42.5);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('parseCsv', () => {
  it('format Mon Budget', () => {
    const rows = parseCsv('Type,Label,Montant,Catégorie,Date\nRevenu,Salaire,2500.00,principal,2026-03-01\nDépense,Loyer,800,fixe,2026-03-02');
    expect(rows).toEqual([
      { type: 'revenu', label: 'Salaire', amount: 2500, category: 'principal', date: '2026-03-01' },
      { type: 'depense', label: 'Loyer', amount: 800, category: 'fixe', date: '2026-03-02' },
    ]);
  });

  it('relevé bancaire débit/crédit avec point-virgule', () => {
    const rows = parseCsv('Date;Libellé;Débit;Crédit\n03/03/2026;Courses;45,90;\n04/03/2026;Virement;;100');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ type: 'depense', label: 'Courses', amount: 45.9, date: '2026-03-03' });
    expect(rows[1]).toMatchObject({ type: 'revenu', label: 'Virement', amount: 100 });
  });

  it('format simple : le signe distingue revenu et dépense', () => {
    const rows = parseCsv('Café,-3.5,2026-03-01\nPrime,200,2026-03-02');
    expect(rows.map((r) => r.type)).toEqual(['depense', 'revenu']);
  });

  it('gère les guillemets et ignore les lignes invalides', () => {
    const rows = parseCsv('Label,Montant,Date\n"Resto, ""chez Paul""",30,2026-03-01\nvide,0,2026-03-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Resto, "chez Paul"');
  });
});

describe('toCsv', () => {
  it('produit un export réimportable', () => {
    const csv = toCsv(
      [{ id: '1', label: 'Salaire, net', amount: 2000, category: 'principal', type: 'salaire', date: '2026-03-01', recurring: false, recurring_group_id: null, created_at: '', updated_at: '' }],
      [{ id: '2', label: 'Loyer', amount: 700.5, category: 'fixe', envelope_id: null, date: '2026-03-02', recurring: false, recurring_group_id: null, created_at: '', updated_at: '' }],
    );
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      { type: 'revenu', label: 'Salaire, net', amount: 2000, category: 'principal', date: '2026-03-01' },
      { type: 'depense', label: 'Loyer', amount: 700.5, category: 'fixe', date: '2026-03-02' },
    ]);
  });
});
