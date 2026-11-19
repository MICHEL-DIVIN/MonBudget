# Mon Budget — API (NestJS)

API REST NestJS 12 (ESM) + Prisma 6 + PostgreSQL pour l'application mobile.

## Démarrage

```bash
cd backend
cp .env.example .env            # renseigner JWT_ACCESS_SECRET (≥ 32 caractères aléatoires)
docker compose up -d db         # PostgreSQL sur le port 5433
npm install
npx prisma migrate dev          # crée les tables
npm run build && npm run start:prod      # ou : npm run start:dev
```

API sur `http://localhost:3000/api` — santé : `GET /api/health`.

| Commande | Rôle |
|---|---|
| `npm run start:dev` | Mode développement (watch) |
| `npm test` | Tests unitaires (validation / sérialisation des enregistrements) |
| `npm run smoke` | Test de bout en bout contre un serveur lancé (voir en-tête de `test/smoke.mjs`) |
| `npm run db:migrate` / `db:deploy` | Migrations Prisma (dev / prod) |

Premier administrateur :
```sql
UPDATE users SET role = 'admin' WHERE email = 'vous@example.com';
```

## Endpoints

Tous les champs JSON sont en `snake_case`. Tout est protégé par `Authorization: Bearer <access_token>` sauf `/auth/*` et `/health`.

| Route | Description |
|---|---|
| `POST /auth/register` · `/auth/login` · `/auth/google` | Retourne `{ access_token, refresh_token, user }` |
| `POST /auth/refresh` | Rotation du refresh token (la réutilisation d'un ancien token révoque toutes les sessions) |
| `POST /auth/logout` | Révoque le refresh token |
| `POST /auth/forgot-password` · `/auth/reset-password` | Code à 6 chiffres par email (15 min, 5 essais) |
| `POST /auth/change-password` | Ferme les autres sessions |
| `GET/PATCH/DELETE /me` | Profil, suppression du compte |
| `POST /sync/push` | `{ changes: [{ store, op: 'upsert'\|'delete', data }] }` (≤ 500, appliqués dans l'ordre) |
| `GET /sync/pull?since=ISO` | Changements (suppressions incluses) ; `has_more` + `next_since` si pagination |
| `GET /notifications` · `PATCH /notifications/:id/read` · `POST /notifications/read-all` · `DELETE /notifications/:id` | Boîte de réception |
| `POST/DELETE /push/register` | Jeton push Expo de l'appareil |
| `POST /support` · `GET /support` | Contact / historique |
| `GET /admin/stats` · `GET /admin/users` · `PATCH /admin/users/:id/role` · `DELETE /admin/users/:id` · `POST /admin/notifications` · `GET/PATCH /admin/support` · `GET /admin/audit` | Réservé au rôle `admin` (relu en base à chaque appel) |

Stores synchronisés : `envelopes`, `revenus`, `depenses`, `objectifs`.

## Choix de conception

- **Offline-first** : ids UUID générés par le client ; `updated_at` (client) arbitre les conflits (last-write-wins, plafonné à +5 min d'avance) ; `server_updated_at` (serveur) sert de curseur de `pull` ; suppressions logiques (`deleted_at`).
- **Aucune confiance envers le client** : champs whitelistés et validés par collection (`src/sync/records.ts`), `user_id` toujours imposé par le jeton, jamais lu du corps ; une ligne d'un autre utilisateur est rejetée.
- **Authentification** : access token JWT court (15 min) + refresh token opaque haché en base (SHA-256), mots de passe bcrypt (coût 12), réponses identiques pour compte inconnu / mauvais mot de passe, rate limiting global et renforcé sur `/auth/*`.
- **Droits admin** relus en base (un jeton ne suffit pas), actions sensibles tracées dans `audit_log`.

## Production

```bash
docker build -t monbudget-api .
docker run -p 3000:3000 --env-file .env monbudget-api     # applique les migrations puis démarre
```

Suivi des erreurs (Sentry, SDK `@sentry/nestjs`) : définir `SENTRY_DSN`. L'initialisation est dans `src/instrument.ts`, chargé avant tout le reste (`node --import ./dist/instrument.js dist/main.js`). Seules les erreurs inattendues (5xx) sont envoyées, sans corps de requête, cookie ni en-tête d'authentification ; l'erreur est rattachée à l'identifiant interne du compte. Vérification : `GET /api/admin/debug-sentry` (admin) provoque une erreur de test. `SENTRY_DEBUG=true` affiche le détail des envois dans les logs.

Variables à définir : `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS` (vide pour une app mobile seule), `SMTP_*` + `MAIL_FROM` (sans SMTP, les codes de réinitialisation sont seulement écrits dans les logs), `GOOGLE_CLIENT_IDS`. Placez l'API derrière HTTPS (reverse proxy) : les builds mobiles de production refusent le HTTP.
