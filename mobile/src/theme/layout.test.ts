import { describe, expect, it } from 'vitest';
import { computeLayout, CONTENT_MAX_WIDTH, gridColumns } from './layoutCore';

describe('computeLayout', () => {
  it('petit téléphone : compact, marges et titres réduits', () => {
    const l = computeLayout(320, 568);
    expect(l.compact).toBe(true);
    expect(l.short).toBe(true);
    expect(l.gutter).toBe(12);
    expect(l.typeScale).toBeLessThan(1);
  });

  it('téléphone standard : valeurs de référence', () => {
    const l = computeLayout(390, 844);
    expect([l.compact, l.short, l.tablet]).toEqual([false, false, false]);
    expect(l.typeScale).toBe(1);
    expect(l.scale(100)).toBe(100);
  });

  it('tablette : colonne de contenu bornée et centrée', () => {
    const l = computeLayout(1024, 1366);
    expect(l.tablet).toBe(true);
    expect(l.contentWidth).toBe(CONTENT_MAX_WIDTH);
    expect(l.scale(100)).toBeLessThanOrEqual(110);
  });
});

describe('gridColumns', () => {
  it('4 colonnes minimum, 6 maximum', () => {
    expect(gridColumns(300)).toBe(4);
    expect(gridColumns(420)).toBe(5);
    expect(gridColumns(900)).toBe(6);
  });
});
