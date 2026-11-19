import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { serializeUser } from '../common/user.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'XOF', 'XAF', 'CAD', 'CHF'];
const LOCALES = ['fr-FR', 'en-US', 'en-GB', 'fr-CA', 'fr-CH'];

class UpdateMeDto {
  @IsOptional() @IsString() @MaxLength(100)
  full_name?: string;

  /** Data URL (image compressée côté app) ou URL ; ~300 Ko max. */
  @IsOptional() @IsString() @MaxLength(300_000)
  avatar_url?: string | null;

  @IsOptional() @IsIn(CURRENCIES)
  currency?: string;

  @IsOptional() @IsIn(LOCALES)
  locale?: string;
}

class DeleteMeDto {
  @IsOptional() @IsString() @MaxLength(128)
  password?: string;
}

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@CurrentUser() auth: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw new NotFoundException();
    return serializeUser(user);
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body() dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: auth.id },
      data: {
        ...(dto.full_name !== undefined && { fullName: dto.full_name.trim() }),
        ...(dto.avatar_url !== undefined && { avatarUrl: dto.avatar_url }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
    });
    return serializeUser(user);
  }

  /** Suppression définitive du compte et de toutes ses données. */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() auth: AuthUser, @Body() dto: DeleteMeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: auth.id } });
    if (!user) throw new NotFoundException();
    if (user.passwordHash && !(dto.password && (await bcrypt.compare(dto.password, user.passwordHash)))) {
      throw new BadRequestException('Mot de passe incorrect');
    }
    await this.prisma.user.delete({ where: { id: auth.id } });
  }
}
