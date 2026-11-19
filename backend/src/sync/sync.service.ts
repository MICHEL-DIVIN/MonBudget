import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseBase, parseFields, RecordError, serialize, STORES, type Store } from './records.js';
import type { ChangeDto } from './sync.dto.js';

export interface PushResult {
  server_time: string;
  applied: number;
  /** Changements ignorés car une version plus récente existe déjà côté serveur (le pull la renverra). */
  stale: number;
  rejected: { id: string | null; store: string; reason: string }[];
}

const PAGE_SIZE = 2000;
/** Marge de recouvrement pour ne jamais rater une ligne écrite pendant une lecture. */
const PULL_OVERLAP_MS = 5000;

@Injectable()
export class SyncService {
  private readonly log = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  private delegate(store: Store): any {
    switch (store) {
      case 'envelopes':
        return this.prisma.envelope;
      case 'revenus':
        return this.prisma.revenu;
      case 'depenses':
        return this.prisma.depense;
      case 'objectifs':
        return this.prisma.objectif;
    }
  }

  async push(userId: string, changes: ChangeDto[]): Promise<PushResult> {
    const result: PushResult = { server_time: new Date().toISOString(), applied: 0, stale: 0, rejected: [] };

    // Ordre d'arrivée conservé : une enveloppe créée avant la dépense qui la référence existe déjà.
    for (const change of changes) {
      const id = typeof change.data?.id === 'string' ? change.data.id : null;
      try {
        const outcome = await this.applyChange(userId, change);
        if (outcome === 'applied') result.applied++;
        else result.stale++;
      } catch (err) {
        if (err instanceof RecordError) {
          result.rejected.push({ id, store: change.store, reason: err.message });
        } else {
          this.log.error(`push ${change.store}/${id}: ${(err as Error).message}`);
          result.rejected.push({ id, store: change.store, reason: 'erreur serveur' });
        }
      }
    }
    return result;
  }

  private async applyChange(userId: string, change: ChangeDto): Promise<'applied' | 'stale'> {
    const { store, op, data } = change;
    const now = new Date();
    const base = parseBase(data, now);
    const table = this.delegate(store);

    const existing = await table.findUnique({ where: { id: base.id }, select: { userId: true, updatedAt: true } });
    if (existing && existing.userId !== userId) throw new RecordError('enregistrement inaccessible');
    // Last-write-wins sur l'horloge client (ex æquo : le serveur garde sa version).
    if (existing && existing.updatedAt.getTime() >= base.updatedAt.getTime() && !(op === 'delete')) return 'stale';
    if (existing && op === 'delete' && existing.updatedAt.getTime() > base.updatedAt.getTime()) return 'stale';

    if (op === 'delete') {
      if (!existing) return 'applied'; // rien à supprimer
      await this.prisma.$transaction(async (tx) => {
        const t = store === 'envelopes' ? tx.envelope : store === 'revenus' ? tx.revenu : store === 'depenses' ? tx.depense : tx.objectif;
        await (t as any).update({
          where: { id: base.id },
          data: { deletedAt: now, updatedAt: base.updatedAt, serverUpdatedAt: now },
        });
        if (store === 'envelopes') {
          // Détache les dépenses pour que les autres appareils reçoivent la correction.
          await tx.depense.updateMany({
            where: { userId, envelopeId: base.id },
            data: { envelopeId: null, serverUpdatedAt: now },
          });
        }
      });
      return 'applied';
    }

    const fields = parseFields(store, data);

    if (store === 'depenses' && fields.envelopeId) {
      const env = await this.prisma.envelope.findFirst({
        where: { id: fields.envelopeId as string, userId, deletedAt: null },
        select: { id: true },
      });
      if (!env) fields.envelopeId = null;
    }

    if (existing) {
      await table.update({
        where: { id: base.id },
        data: { ...fields, updatedAt: base.updatedAt, serverUpdatedAt: now, deletedAt: null },
      });
    } else {
      await table.create({
        data: { ...fields, id: base.id, userId, createdAt: base.createdAt, updatedAt: base.updatedAt, serverUpdatedAt: now },
      });
    }
    return 'applied';
  }

  /**
   * Renvoie les changements (y compris suppressions) depuis `since`.
   * Si `has_more` est vrai, le client doit rappeler avec `next_since`.
   */
  async pull(userId: string, since?: string) {
    const serverTime = new Date();
    const from = since ? new Date(new Date(since).getTime() - PULL_OVERLAP_MS) : new Date(0);

    const out: Record<string, unknown[]> = {};
    let hasMore = false;
    let nextSince = serverTime;

    for (const store of STORES) {
      const rows = await this.delegate(store).findMany({
        where: { userId, serverUpdatedAt: { gte: from } },
        orderBy: { serverUpdatedAt: 'asc' },
        take: PAGE_SIZE + 1,
      });
      if (rows.length > PAGE_SIZE) {
        hasMore = true;
        rows.pop();
        const last: Date = rows[rows.length - 1].serverUpdatedAt;
        if (last < nextSince) nextSince = last;
      }
      out[store] = rows.map((r: unknown) => serialize(store, r));
    }

    return { ...out, server_time: serverTime.toISOString(), has_more: hasMore, next_since: nextSince.toISOString() };
  }
}
