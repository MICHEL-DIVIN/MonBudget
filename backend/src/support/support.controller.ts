import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

class SupportDto {
  @IsString() @MinLength(5) @MaxLength(4000)
  message!: string;
}

@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async create(@CurrentUser() auth: AuthUser, @Body() dto: SupportDto) {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id }, select: { email: true } });
    const msg = await this.prisma.supportMessage.create({
      data: { userId: auth.id, userEmail: user?.email, message: dto.message.trim() },
    });
    return { id: msg.id };
  }

  /** Historique de mes demandes (avec la réponse de l'équipe si elle existe). */
  @Get()
  async mine(@CurrentUser() auth: AuthUser) {
    const rows = await this.prisma.supportMessage.findMany({
      where: { userId: auth.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((m) => ({
      id: m.id,
      message: m.message,
      status: m.status,
      admin_reply: m.adminReply,
      created_at: m.createdAt.toISOString(),
    }));
  }
}
