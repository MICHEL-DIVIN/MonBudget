import type { Depense, Revenu } from './types';

export interface ImportRow {
  type: 'revenu' | 'depense';
  label: string;
  amount: number;
  category: string;
  date: string;
}

/** Le séparateur est celui du fichier : « ; » (Excel FR, virgule décimale) ou « , ». */
function detectDelimiter(firstLine: string): ',' | ';' {
  const semi = (firstLine.match(/;/g) ?? []).length;
  const comma = (firstLine.match(/,/g) ?? []).length;
  return semi > 0 && semi >= comma ? ';' : ',';
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

export function parseDate(raw: string, fallback = new Date()): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  const base = Number.isNaN(d.getTime()) ? fallback : d;
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Math.abs(parseFloat(cleaned)) || 0;
}

/**
 * Accepte trois formats :
 *  1. export Mon Budget : Type, Label, Montant, Catégorie, Date
 *  2. relevé bancaire : Date, Libellé, Débit, Crédit (ou Montant)
 *  3. simple : Label, Montant (négatif = dépense), Date
 */
export function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const header = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase());
  const isHeader = header.some(
    (h) => h.includes('libell') || h.includes('label') || h.includes('montant') || h.includes('amount') || h.includes('date'),
  );
  const dataLines = isHeader ? lines.slice(1) : lines;
  const rows: ImportRow[] = [];

  const dateIdx = header.findIndex((h) => h.includes('date'));
  const labelIdx = header.findIndex((h) => h.includes('libell') || h.includes('label') || h.includes('description') || h.includes('intitul'));
  const debitIdx = header.findIndex((h) => h.includes('débit') || h.includes('debit'));
  const creditIdx = header.findIndex((h) => h.includes('crédit') || h.includes('credit'));
  const amountIdx = header.findIndex((h) => h.includes('montant') || h.includes('amount') || h.includes('somme'));

  for (const line of dataLines) {
    const cols = parseCsvLine(line, delimiter);
    if (cols.length < 2) continue;
    const first = cols[0].toLowerCase();

    if (cols.length >= 5 && (first.includes('revenu') || first.includes('depense') || first.includes('dépense'))) {
      rows.push({
        type: first.includes('revenu') ? 'revenu' : 'depense',
        label: cols[1],
        amount: parseAmount(cols[2]),
        category: cols[3] || 'autre',
        date: parseDate(cols[4]),
      });
      continue;
    }

    if (isHeader && (labelIdx >= 0 || debitIdx >= 0 || creditIdx >= 0 || amountIdx >= 0)) {
      const label = labelIdx >= 0 ? cols[labelIdx] : cols[1] || 'Transaction';
      const date = parseDate(dateIdx >= 0 ? cols[dateIdx] ?? '' : cols[0]);
      const debit = debitIdx >= 0 ? parseAmount(cols[debitIdx] ?? '') : 0;
      const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] ?? '') : 0;
      let amount = credit > 0 ? credit : debit;
      let isCredit = credit > 0;
      if (amount === 0 && debitIdx < 0 && creditIdx < 0 && amountIdx >= 0) {
        // Colonne unique « Montant » : le signe distingue dépense (-) et revenu (+).
        const raw = cols[amountIdx] ?? '';
        amount = parseAmount(raw);
        isCredit = !raw.trim().startsWith('-');
      }
      if (amount <= 0) continue;
      rows.push({
        label,
        amount,
        category: isCredit ? 'secondaire' : 'variable',
        date,
        type: isCredit ? 'revenu' : 'depense',
      });
      continue;
    }

    if (cols.length >= 3) {
      const amount = parseAmount(cols[1]);
      if (amount <= 0) continue;
      const signed = parseFloat(cols[1].replace(',', '.'));
      rows.push({ label: cols[0], amount, category: 'autre', date: parseDate(cols[2]), type: signed >= 0 ? 'revenu' : 'depense' });
    }
  }

  return rows.filter((r) => r.label && r.amount > 0).slice(0, 5000);
}

const escapeCell = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Export réimportable (même format que l'import n°1). */
export function toCsv(revenus: Revenu[], depenses: Depense[]): string {
  const lines = ['Type,Label,Montant,Catégorie,Date'];
  for (const r of revenus) lines.push(['Revenu', r.label, r.amount.toFixed(2), r.category, r.date].map(escapeCell).join(','));
  for (const d of depenses) lines.push(['Dépense', d.label, d.amount.toFixed(2), d.category, d.date].map(escapeCell).join(','));
  return '﻿' + lines.join('\n');
}
