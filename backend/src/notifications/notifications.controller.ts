import { Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

function serialize(n: { id: string; title: string; body: string; type: string; read: boolean; createdAt: Date }) {
  return { id: n.id, title: n.title, body: n.body, type: n.type, read: n.read, created_at: n.createdAt.toISOString() };
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map(serialize);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  }

  @Patch(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const res = await this.prisma.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
    if (res.count === 0) throw new NotFoundException();
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId: user.id } });
  }
}
