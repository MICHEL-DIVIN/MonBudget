import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { IsString, Matches, MaxLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { PrismaService } from '../prisma/prisma.service.js';

const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

class PushTokenDto {
  @IsString() @MaxLength(200) @Matches(EXPO_TOKEN_RE, { message: 'Jeton push Expo invalide' })
  token!: string;

  @IsString() @MaxLength(20)
  platform!: string;
}

class RemoveTokenDto {
  @IsString() @MaxLength(200)
  token!: string;
}

@Controller('push')
export class PushController {
  constructor(private readonly prisma: PrismaService) {}

  /** Enregistre (ou rattache à l'utilisateur courant) le jeton push de l'appareil. */
  @Post('register')
  @HttpCode(204)
  async register(@CurrentUser() user: AuthUser, @Body() dto: PushTokenDto) {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      create: { token: dto.token, platform: dto.platform, userId: user.id },
      update: { userId: user.id, platform: dto.platform },
    });
  }

  @Delete('register')
  @HttpCode(204)
  async unregister(@CurrentUser() user: AuthUser, @Body() dto: RemoveTokenDto) {
    await this.prisma.pushToken.deleteMany({ where: { token: dto.token, userId: user.id } });
  }
}
