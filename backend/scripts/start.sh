#!/bin/sh
# Démarrage en production : applique les migrations puis lance l'API.
# Échoue vite et clairement plutôt que de rester bloqué sans ouvrir de port.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERREUR : la variable DATABASE_URL n'est pas définie." >&2
  exit 1
fi

if [ -z "$DIRECT_URL" ]; then
  echo "ERREUR : la variable DIRECT_URL n'est pas définie." >&2
  echo "Les migrations Prisma ont besoin d'une connexion directe (hors pooler en mode transaction)." >&2
  echo "Supabase : même URL que DATABASE_URL mais port 5432 et sans '?pgbouncer=true'." >&2
  echo "Base classique : même valeur que DATABASE_URL." >&2
  exit 1
fi

echo "Application des migrations…"
if ! timeout 90 npx prisma migrate deploy; then
  echo "ERREUR : les migrations ont échoué ou dépassé 90 s. Vérifiez DIRECT_URL (port 5432, accessible depuis l'hébergeur)." >&2
  exit 1
fi

echo "Démarrage de l'API…"
exec node --import ./dist/instrument.js dist/main.js
