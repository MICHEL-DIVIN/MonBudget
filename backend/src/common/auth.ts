import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthUser {
  id: string;
}

export type AuthedRequest = Request & { user: AuthUser };

const PUBLIC_KEY = 'isPublic';
const ADMIN_KEY = 'adminOnly';

/** Route accessible sans jeton. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Route réservée aux administrateurs (le rôle est relu en base, pas dans le jeton). */
export const AdminOnly = () => SetMetadata(ADMIN_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

/** Guard global : toutes les routes exigent un access token sauf @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Jeton manquant');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token);
    } catch {
      throw new UnauthorizedException('Jeton invalide ou expiré');
    }

    if (this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, targets)) {
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true } });
      if (!user) throw new UnauthorizedException('Compte introuvable');
      if (user.role !== 'admin') throw new ForbiddenException('Réservé aux administrateurs');
      req.user = { id: payload.sub };
      Sentry.setUser({ id: payload.sub });
      return true;
    }

    req.user = { id: payload.sub };
    Sentry.setUser({ id: payload.sub });
    return true;
  }
}
