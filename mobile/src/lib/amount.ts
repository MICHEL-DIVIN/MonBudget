/**
 * Saisie d'un montant au pavé numérique, sous forme de texte « 1234,5 ».
 * 2 décimales max (0 pour XOF/XAF), 8 chiffres avant la virgule.
 */
export function applyKey(current: string, key: string, decimals = 2): string {
  if (key === 'clear') return '';
  if (key === 'del') return current.slice(0, -1);
  if (key === ',') {
    if (decimals === 0 || current.includes(',')) return current;
    return (current || '0') + ',';
  }
  if (!/^\d$/.test(key)) return current;
  const [int, dec] = current.split(',');
  if (dec !== undefined) return dec.length >= decimals ? current : current + key;
  if (int === '0') return key;
  if (int.length >= 8) return current;
  return current + key;
}

export function amountFromInput(input: string): number {
  const n = Number(input.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** Montant existant → texte du pavé (« 12,5 »). */
export function inputFromAmount(n: number): string {
  if (!n) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}
