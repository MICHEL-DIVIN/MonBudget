/**
 * Initialisation de Sentry — doit s'exécuter AVANT tout le reste de l'application.
 * Le serveur est lancé avec `node --import ./dist/instrument.js dist/main.js` (modules ES) pour que
 * Sentry instrumente Express et les requêtes sortantes dès le départ.
 *
 * Désactivé tant que SENTRY_DSN n'est pas défini. Confidentialité (API financière) :
 * aucun corps de requête, cookie ni en-tête d'authentification n'est transmis.
 */
import * as Sentry from '@sentry/nestjs';

// Ce fichier passe avant ConfigModule : on charge .env nous-mêmes (s'il existe).
try {
  process.loadEnvFile();
} catch {
  /* pas de .env : variables fournies par l'environnement (Docker, hébergeur…) */
}

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    debug: process.env.SENTRY_DEBUG === 'true',
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        if (event.request.headers) {
          for (const h of Object.keys(event.request.headers)) {
            if (/authorization|cookie/i.test(h)) delete event.request.headers[h];
          }
        }
      }
      delete event.user?.email;
      delete event.user?.ip_address;
      return event;
    },
  });
}
