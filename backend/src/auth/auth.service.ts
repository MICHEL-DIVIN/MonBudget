import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { serializeUser } from '../common/user.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const BCRYPT_COST = 12;
const RESET_TTL_MS = 15 * 60_000;
const RESET_MAX_ATTEMPTS = 5;
// Hash factice : on compare toujours, que le compte existe ou non (même temps de réponse).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_COST);

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  private readonly google = new OAuth2Client();
  private readonly googleClientIds: string[];
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    this.googleClientIds = (config.get<string>('GOOGLE_CLIENT_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.refreshTtlMs = Number(config.get('REFRESH_TOKEN_TTL_DAYS') ?? 60) * 86_400_000;
  }

  private async issueTokens(user: User, userAgent?: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
        userAgent: userAgent?.slice(0, 200),
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    return { access_token: accessToken, refresh_token: refreshToken, user: serializeUser(user) };
  }

  async register(email: string, password: string, fullName: string | undefined, userAgent?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Un compte existe déjà avec cet email');
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        fullName: (fullName ?? '').trim() || email.split('@')[0],
      },
    });
    return this.issueTokens(user, userAgent);
  }

  async login(email: string, password: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) throw new UnauthorizedException('Email ou mot de passe incorrect');
    return this.issueTokens(user, userAgent);
  }

  async loginWithGoogle(idToken: string, userAgent?: string) {
    if (this.googleClientIds.length === 0) throw new BadRequestException('Connexion Google non configurée');
    let payload;
    try {
      const ticket = await this.google.verifyIdToken({ idToken, audience: this.googleClientIds });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Jeton Google invalide');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Email Google non vérifié');
    }
    const email = payload.email.toLowerCase();

    let user = await this.prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (!user) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      user = byEmail
        ? await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: payload.sub } })
        : await this.prisma.user.create({
            data: {
              email,
              googleId: payload.sub,
              fullName: payload.name ?? email.split('@')[0],
              avatarUrl: payload.picture ?? null,
            },
          });
    }
    return this.issueTokens(user, userAgent);
  }

  /** Rotation : l'ancien refresh token est révoqué à chaque usage. Un token déjà utilisé révoque toute la famille. */
  async refresh(refreshToken: string, userAgent?: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException('Session invalide');
    if (record.revokedAt) {
      // Réutilisation d'un token déjà consommé : vol probable, on coupe toutes les sessions.
      await this.revokeAll(record.userId);
      throw new UnauthorizedException('Session invalide');
    }
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Session expirée');

    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(record.user, userAgent);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private revokeAll(userId: string) {
    return this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Répond toujours de la même façon pour ne pas révéler quels emails ont un compte. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetCode.create({
        data: { userId: user.id, codeHash: sha256(`${user.id}:${code}`), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      }),
    ]);
    await this.mail.sendPasswordResetCode(email, code);
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const invalid = new BadRequestException('Code invalide ou expiré');
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw invalid;

    const entry = await this.prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry || entry.attempts >= RESET_MAX_ATTEMPTS) throw invalid;

    const given = Buffer.from(sha256(`${user.id}:${code}`));
    const expected = Buffer.from(entry.codeHash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      await this.prisma.passwordResetCode.update({ where: { id: entry.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) } }),
      this.prisma.passwordResetCode.update({ where: { id: entry.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }

  async changePassword(userId: string, current: string, next: string, keepRefreshToken?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    // Un compte Google sans mot de passe peut en définir un sans fournir l'actuel.
    if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, BCRYPT_COST) } });
    // Les autres appareils doivent se reconnecter.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, ...(keepRefreshToken ? { tokenHash: { not: sha256(keepRefreshToken) } } : {}) },
      data: { revokedAt: new Date() },
    });
  }
}
