import type { User } from '@prisma/client';

/** Représentation publique d'un compte (jamais de hash ni d'identifiants tiers). */
export function serializeUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    avatar_url: u.avatarUrl,
    currency: u.currency,
    locale: u.locale,
    role: u.role,
    has_password: u.passwordHash !== null,
    created_at: u.createdAt.toISOString(),
    updated_at: u.updatedAt.toISOString(),
  };
}
