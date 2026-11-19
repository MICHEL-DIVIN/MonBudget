import { Controller, HttpCode, NotFoundException, Patch } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/auth.js';
import { serializeUser } from '../common/user.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Marque la visite guidée comme vue. Idempotent : peut être rappelé sans risque (le mobile
   * réessaie tant qu'il n'a pas reçu de confirmation). Le compte vient du jeton, jamais du corps.
   */
  @Patch('me/tour-seen')
  @HttpCode(200)
  async tourSeen(@CurrentUser() auth: AuthUser) {
    const res = await this.prisma.user.updateMany({ where: { id: auth.id }, data: { hasSeenTour: true } });
    if (res.count === 0) throw new NotFoundException();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: auth.id } });
    return serializeUser(user);
  }
}
