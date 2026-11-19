import { describe, expect, it } from 'vitest';
import { amountFromInput, applyKey, inputFromAmount } from './amount';

const type = (keys: string[], decimals = 2) => keys.reduce((s, k) => applyKey(s, k, decimals), '');

describe('applyKey', () => {
  it('saisit un montant décimal', () => {
    expect(type(['1', '2', ',', '5'])).toBe('12,5');
    expect(type([',', '5'])).toBe('0,5');
  });
  it('limite à 2 décimales et une seule virgule', () => {
    expect(type(['1', ',', '2', '3', '4', ','])).toBe('1,23');
  });
  it('pas de zéro initial inutile', () => {
    expect(type(['0', '0', '7'])).toBe('7');
  });
  it('sans décimales pour XOF/XAF', () => {
    expect(type(['5', ',', '0', '0'], 0)).toBe('500');
  });
  it('effacer et tout effacer', () => {
    expect(applyKey('12,5', 'del')).toBe('12,');
    expect(applyKey('12,5', 'clear')).toBe('');
  });
  it('plafonne à 8 chiffres', () => {
    expect(type('123456789'.split(''))).toBe('12345678');
  });
});

describe('conversions', () => {
  it('aller-retour', () => {
    expect(amountFromInput('12,5')).toBe(12.5);
    expect(amountFromInput('')).toBe(0);
    expect(inputFromAmount(700.5)).toBe('700,5');
    expect(inputFromAmount(0)).toBe('');
  });
});
