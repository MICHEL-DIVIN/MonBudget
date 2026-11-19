/**
 * Définition des 4 collections synchronisées : validation des données entrantes
 * (jamais de confiance envers le client) et sérialisation « snake_case » vers l'API.
 */

export const STORES = ['envelopes', 'revenus', 'depenses', 'objectifs'] as const;
export type Store = (typeof STORES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

export class RecordError extends Error {}

type Raw = Record<string, unknown>;

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function reqUuid(v: unknown, field: string): string {
  if (!isUuid(v)) throw new RecordError(`${field} invalide`);
  return v.toLowerCase();
}

function optUuid(v: unknown, field: string): string | null {
  if (v === null || v === undefined || v === '') return null;
  return reqUuid(v, field);
}

function reqText(v: unknown, field: string, max = 120): string {
  if (typeof v !== 'string') throw new RecordError(`${field} requis`);
  const t = v.trim();
  if (t.length === 0 || t.length > max) throw new RecordError(`${field} invalide`);
  return t;
}

function optText(v: unknown, field: string, max: number, fallback: string): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string' || v.length > max) throw new RecordError(`${field} invalide`);
  return v;
}

function num(v: unknown, field: string, { min, max, minExclusive = false }: { min: number; max: number; minExclusive?: boolean }): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new RecordError(`${field} invalide`);
  if (minExclusive ? n <= min : n < min) throw new RecordError(`${field} hors limites`);
  if (n >= max) throw new RecordError(`${field} hors limites`);
  return Math.round(n * 100) / 100;
}

export function parseDay(v: unknown, field: string): Date {
  if (typeof v !== 'string') throw new RecordError(`${field} invalide`);
  const day = v.slice(0, 10);
  if (!DATE_RE.test(day)) throw new RecordError(`${field} invalide`);
  const d = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== day) throw new RecordError(`${field} invalide`);
  return d;
}

function optDay(v: unknown, field: string): Date | null {
  if (v === null || v === undefined || v === '') return null;
  return parseDay(v, field);
}

function timestamp(v: unknown, field: string, now: Date): Date {
  if (typeof v !== 'string') throw new RecordError(`${field} requis`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new RecordError(`${field} invalide`);
  // Une horloge client très en avance gagnerait tous les conflits : on plafonne.
  return d.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS ? now : d;
}

/** Champs communs : id, created_at, updated_at (horloge client). */
export function parseBase(data: Raw, now: Date) {
  const id = reqUuid(data.id, 'id');
  const updatedAt = timestamp(data.updated_at ?? now.toISOString(), 'updated_at', now);
  const createdAt = data.created_at === undefined ? updatedAt : timestamp(data.created_at, 'created_at', now);
  return { id, updatedAt, createdAt };
}

/** Valide et convertit les champs métier d'un enregistrement entrant. */
export function parseFields(store: Store, data: Raw): Record<string, unknown> {
  switch (store) {
    case 'envelopes':
      return {
        name: reqText(data.name, 'name'),
        budgeted: num(data.budgeted ?? 0, 'budgeted', { min: 0, max: 1e9 }),
        color: optText(data.color, 'color', 60, 'bg-primary-fixed'),
        icon: optText(data.icon, 'icon', 60, 'category'),
        sortOrder: Math.trunc(num(data.sort_order ?? 0, 'sort_order', { min: -1e6, max: 1e6 })),
      };
    case 'revenus': {
      if (data.category !== 'principal' && data.category !== 'secondaire') throw new RecordError('category invalide');
      return {
        label: reqText(data.label, 'label'),
        amount: num(data.amount, 'amount', { min: 0, max: 1e8, minExclusive: true }),
        category: data.category,
        type: optText(data.type, 'type', 40, 'autre'),
        date: parseDay(data.date, 'date'),
        recurring: data.recurring === true,
        recurringGroupId: optUuid(data.recurring_group_id, 'recurring_group_id'),
      };
    }
    case 'depenses': {
      if (data.category !== 'fixe' && data.category !== 'variable') throw new RecordError('category invalide');
      return {
        label: reqText(data.label, 'label'),
        amount: num(data.amount, 'amount', { min: 0, max: 1e8, minExclusive: true }),
        category: data.category,
        envelopeId: optUuid(data.envelope_id, 'envelope_id'),
        date: parseDay(data.date, 'date'),
        recurring: data.recurring === true,
        recurringGroupId: optUuid(data.recurring_group_id, 'recurring_group_id'),
      };
    }
    case 'objectifs':
      return {
        label: reqText(data.label, 'label'),
        targetAmount: num(data.target_amount ?? 0, 'target_amount', { min: 0, max: 1e9 }),
        currentAmount: num(data.current_amount ?? 0, 'current_amount', { min: 0, max: 1e9 }),
        deadline: optDay(data.deadline, 'deadline'),
      };
  }
}

const iso = (d: Date) => d.toISOString();
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const money = (d: { toString(): string }) => Number(d.toString());

/** Sérialisation d'une ligne Prisma vers le format « fil » (snake_case, montants en nombres). */
export function serialize(store: Store, r: any): Record<string, unknown> {
  const common = {
    id: r.id,
    user_id: r.userId,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
    deleted_at: r.deletedAt ? iso(r.deletedAt) : null,
  };
  switch (store) {
    case 'envelopes':
      return { ...common, name: r.name, budgeted: money(r.budgeted), color: r.color, icon: r.icon, sort_order: r.sortOrder };
    case 'revenus':
      return {
        ...common,
        label: r.label,
        amount: money(r.amount),
        category: r.category,
        type: r.type,
        date: day(r.date),
        recurring: r.recurring,
        recurring_group_id: r.recurringGroupId,
      };
    case 'depenses':
      return {
        ...common,
        label: r.label,
        amount: money(r.amount),
        category: r.category,
        envelope_id: r.envelopeId,
        date: day(r.date),
        recurring: r.recurring,
        recurring_group_id: r.recurringGroupId,
      };
    case 'objectifs':
      return {
        ...common,
        label: r.label,
        target_amount: money(r.targetAmount),
        current_amount: money(r.currentAmount),
        deadline: day(r.deadline),
      };
  }
}
