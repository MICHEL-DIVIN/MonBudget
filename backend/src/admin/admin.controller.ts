import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminOnly, CurrentUser, type AuthUser } from '../common/auth.js';
import { serializeUser } from '../common/user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PushService } from '../push/push.service.js';

class ListUsersQuery {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;
}

class RoleDto {
  @IsIn(['user', 'admin'])
  role!: 'user' | 'admin';
}

class BroadcastDto {
  @IsString() @MinLength(1) @MaxLength(100)
  title!: string;

  @IsString() @MinLength(1) @MaxLength(500)
  body!: string;

  @IsIn(['info', 'warning', 'success', 'promo'])
  type!: 'info' | 'warning' | 'success' | 'promo';

  /** Vide = tous les utilisateurs. */
  @IsOptional() @IsUUID()
  user_id?: string;
}

class SupportUpdateDto {
  @IsOptional() @IsIn(['new', 'read', 'resolved'])
  status?: 'new' | 'read' | 'resolved';

  @IsOptional() @IsString() @MaxLength(4000)
  admin_reply?: string;
}

class LimitQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit?: number;
}

const PAGE = 30;

@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  private audit(actorId: string, action: string, targetId: string | null, details: Record<string, unknown> = {}) {
    return this.prisma.auditLog.create({ data: { actorId, action, targetId, details: details as never } });
  }

  @Get('stats')
  async stats() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const live = { deletedAt: null };
    const [users, newUsers, revenus, depenses, sumRev, sumDep, envelopes, objectifs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.revenu.count({ where: live }),
      this.prisma.depense.count({ where: live }),
      this.prisma.revenu.aggregate({ where: live, _sum: { amount: true } }),
      this.prisma.depense.aggregate({ where: live, _sum: { amount: true } }),
      this.prisma.envelope.count({ where: live }),
      this.prisma.objectif.count({ where: live }),
    ]);
    return {
      total_users: users,
      new_users_30d: newUsers,
      total_revenus: revenus,
      total_depenses: depenses,
      sum_revenus: Number(sumRev._sum.amount ?? 0),
      sum_depenses: Number(sumDep._sum.amount ?? 0),
      total_envelopes: envelopes,
      total_objectifs: objectifs,
    };
  }

  @Get('users')
  async users(@Query() q: ListUsersQuery) {
    const page = q.page ?? 1;
    const where = q.search
      ? {
          OR: [
            { email: { contains: q.search, mode: 'insensitive' as const } },
            { fullName: { contains: q.search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
    ]);
    // L'avatar (data URL volumineuse) n'est pas utile dans une liste.
    return { total, page, page_size: PAGE, items: rows.map((u) => ({ ...serializeUser(u), avatar_url: null })) };
  }

  @Patch('users/:id/role')
  async setRole(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RoleDto) {
    if (id === admin.id) throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    if (target.role === dto.role) return serializeUser(target);
    const updated = await this.prisma.user.update({ where: { id }, data: { role: dto.role } });
    await this.audit(admin.id, 'role_change', id, { old_role: target.role, new_role: dto.role, target_name: target.fullName });
    return serializeUser(updated);
  }

  @Delete('users/:id')
  @HttpCode(204)
  async removeUser(@CurrentUser() admin: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    if (id === admin.id) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte ici');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    await this.prisma.user.delete({ where: { id } });
    await this.audit(admin.id, 'user_delete', id, { email: target.email });
  }

  @Post('notifications')
  async broadcast(@CurrentUser() admin: AuthUser, @Body() dto: BroadcastDto) {
    const recipients = dto.user_id
      ? await this.prisma.user.findMany({ where: { id: dto.user_id }, select: { id: true } })
      : await this.prisma.user.findMany({ select: { id: true } });
    if (recipients.length === 0) throw new NotFoundException('Aucun destinataire');
    await this.prisma.notification.createMany({
      data: recipients.map((r) => ({ userId: r.id, title: dto.title, body: dto.body, type: dto.type, createdBy: admin.id })),
    });
    await this.audit(admin.id, 'broadcast', dto.user_id ?? null, { title: dto.title, recipients: recipients.length });
    void this.push.sendToUsers(recipients.map((r) => r.id), dto.title, dto.body, { type: dto.type, url: '/notifications' });
    return { recipients: recipients.length };
  }

  @Get('support')
  async support(@Query() q: LimitQuery) {
    const rows = await this.prisma.supportMessage.findMany({ orderBy: { createdAt: 'desc' }, take: q.limit ?? 100 });
    return rows.map((m) => ({
      id: m.id,
      user_id: m.userId,
      user_email: m.userEmail,
      message: m.message,
      status: m.status,
      admin_reply: m.adminReply,
      created_at: m.createdAt.toISOString(),
    }));
  }

  @Patch('support/:id')
  async updateSupport(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SupportUpdateDto) {
    const exists = await this.prisma.supportMessage.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    await this.prisma.supportMessage.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.admin_reply !== undefined && { adminReply: dto.admin_reply }),
      },
    });
    return { ok: true };
  }

  /** Vérifie la remontée vers Sentry : provoque volontairement une erreur 500. */
  @Get('debug-sentry')
  debugSentry(): never {
    throw new Error('Erreur de test Sentry (déclenchée depuis /admin/debug-sentry)');
  }

  @Get('audit')
  async auditLog(@Query() q: LimitQuery) {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: q.limit ?? 100 });
    return rows.map((a) => ({
      id: a.id,
      actor_id: a.actorId,
      action: a.action,
      target_id: a.targetId,
      details: a.details,
      created_at: a.createdAt.toISOString(),
    }));
  }
}
