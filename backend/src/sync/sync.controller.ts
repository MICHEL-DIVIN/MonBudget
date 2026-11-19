import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { PullQueryDto, PushDto } from './sync.dto.js';
import { SyncService } from './sync.service.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Envoie la file de mutations locales (upsert / delete), appliquées dans l'ordre. */
  @Post('push')
  @HttpCode(200)
  push(@CurrentUser() user: AuthUser, @Body() body: PushDto) {
    return this.sync.push(user.id, body.changes);
  }

  /** Récupère les changements serveur depuis `since` (ISO 8601) ; sans `since`, tout l'historique. */
  @Get('pull')
  pull(@CurrentUser() user: AuthUser, @Query() query: PullQueryDto) {
    return this.sync.pull(user.id, query.since);
  }
}
