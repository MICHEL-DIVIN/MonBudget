import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Envoie une notification push à des utilisateurs. Ne lève jamais : un échec push ne doit pas bloquer l'appelant. */
  async sendToUsers(userIds: string[], title: string, body: string, data: Record<string, unknown> = {}) {
    if (userIds.length === 0) return;
    const tokens = await this.prisma.pushToken.findMany({ where: { userId: { in: userIds } }, select: { token: true } });
    const list = tokens.map((t) => t.token);

    for (let i = 0; i < list.length; i += CHUNK) {
      const batch = list.slice(i, i + CHUNK);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(batch.map((to) => ({ to, title, body, data, sound: 'default' }))),
        });
        const json = (await res.json()) as { data?: ExpoTicket[] };
        const dead = (json.data ?? [])
          .map((t, idx) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? batch[idx] : null))
          .filter((t): t is string => t !== null);
        if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      } catch (err) {
        this.log.warn(`Envoi push échoué: ${(err as Error).message}`);
      }
    }
  }
}
