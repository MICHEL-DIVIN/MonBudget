import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translations } from './translations';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && name !== 'translations.ts' ? [p] : [];
  });
}

const src = sourceFiles(join(__dirname, '..')).map((f) => readFileSync(f, 'utf8')).join('\n');
const fr = translations.fr as Record<string, string>;
const en = translations.en as Record<string, string>;

describe('traductions', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('chaque clé littérale t("…") du code existe', () => {
    const used = [...src.matchAll(/\bt\(\s*['"`]([^'"`$]+)['"`]/g)].map((m) => m[1]);
    const missing = [...new Set(used)].filter((k) => !(k in fr));
    expect(missing).toEqual([]);
  });

  it('les clés construites dynamiquement existent pour toutes leurs valeurs', () => {
    const expected = [
      ...['salaire', 'freelance', 'immobilier', 'allocation', 'autre'].map((k) => `tx.type.${k}`),
      ...['principal', 'secondaire', 'fixe', 'variable'].map((k) => `tx.cat.${k}`),
      ...['ok', 'limit', 'deficit'].map((k) => `sum.status.${k}`),
      ...['new', 'read', 'resolved'].map((k) => `support.status.${k}`),
      ...['offline', 'recurring', 'envelopes', 'currency', 'export', 'data'].flatMap((k) => [`faq.${k}.q`, `faq.${k}.a`]),
      ...['stats', 'users', 'broadcast', 'support'].map((k) => `admin.tab.${k}`),
      ...['welcome', 'currency', 'envelopes', 'done'].flatMap((k) => [`onboarding.${k}`, `onboarding.${k}Desc`]),
      ...['groceries', 'leisure', 'transport', 'gifts'].map((k) => `onboarding.sugg.${k}`),
      ...['hello', 'left', 'envelopes', 'reminders', 'offline'].flatMap((k) => [`welcome.${k}.title`, `welcome.${k}.body`]),
      ...['hero', 'add', 'activity', 'budget', 'settings'].flatMap((k) => [`tour.${k}.title`, `tour.${k}.body`]),
    ];
    expect(expected.filter((k) => !(k in fr))).toEqual([]);
  });

  it('les messages de santé du budget ont une traduction', () => {
    const keys = [...readFileSync(join(__dirname, 'calculations.ts'), 'utf8').matchAll(/key: "([\w.]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => !(k in fr))).toEqual([]);
  });

  it('les variables {x} sont identiques entre fr et en', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const bad = Object.keys(fr).filter((k) => JSON.stringify(vars(fr[k])) !== JSON.stringify(vars(en[k])));
    expect(bad).toEqual([]);
  });
});
