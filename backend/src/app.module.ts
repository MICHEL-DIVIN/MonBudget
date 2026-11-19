import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminController } from './admin/admin.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './common/auth.js';
import { HealthController } from './health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { MeController } from './me/me.controller.js';
import { NotificationsController } from './notifications/notifications.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PushController } from './push/push.controller.js';
import { PushService } from './push/push.service.js';
import { SupportController } from './support/support.controller.js';
import { SyncModule } from './sync/sync.module.js';
import { UsersController } from './users/users.controller.js';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    SyncModule,
  ],
  controllers: [
    HealthController,
    MeController,
    NotificationsController,
    PushController,
    SupportController,
    AdminController,
    UsersController,
  ],
  providers: [
    // Erreurs inattendues (hors HttpException 4xx) remontées à Sentry ; réponse HTTP inchangée.
    {
      provide: APP_FILTER,
      useFactory: (host: HttpAdapterHost) => new SentryGlobalFilter(host.httpAdapter),
      inject: [HttpAdapterHost],
    },
    PushService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
