# Mon Budget Familial

Gestion de budget familial — **application mobile** (Expo / React Native) + **API NestJS**.

| Dossier | Contenu |
|---|---|
| [`mobile/`](mobile/README.md) | App iOS/Android (Expo SDK 58, Expo Router, SQLite offline-first) |
| [`backend/`](backend/README.md) | API NestJS 12 + Prisma + PostgreSQL (auth JWT, synchronisation, admin) |
| `monbudget/` | Ancienne version web/PWA (Next.js + Supabase), conservée comme référence le temps de la transition |

## Démarrage rapide

```bash
# 1. API
cd backend && cp .env.example .env      # puis éditer JWT_ACCESS_SECRET
docker compose up -d db
npm install && npx prisma migrate dev
npm run start:dev

# 2. App (autre terminal)
cd mobile && npm install && cp .env.example .env   # éditer EXPO_PUBLIC_API_URL
npx expo start
```

Détails, architecture et choix de conception dans chaque README.
