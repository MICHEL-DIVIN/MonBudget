import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') ?? 'Mon Budget <no-reply@localhost>';
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: Number(config.get('SMTP_PORT') ?? 587),
          auth: config.get('SMTP_USER') ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') } : undefined,
        })
      : null;
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    const subject = 'Mon Budget — code de réinitialisation';
    const text = `Votre code de réinitialisation : ${code}\n\nIl est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
    if (!this.transporter) {
      // Développement : pas de SMTP configuré, on affiche le code dans les logs serveur.
      this.log.warn(`[DEV] Code de réinitialisation pour ${to} : ${code}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      // On ne révèle jamais à l'appelant si l'envoi a échoué (anti-énumération de comptes).
      this.log.error(`Envoi email impossible: ${(err as Error).message}`);
    }
  }
}
