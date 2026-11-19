# Mon Budget — application mobile (Expo / React Native)

Application iOS + Android de gestion de budget familial, **offline-first** : tout est enregistré dans une base SQLite locale et synchronisé avec l'API NestJS (`../backend`) dès que le réseau est disponible.

## Démarrage

```bash
cd mobile
npm install
cp .env.example .env      # puis renseigner EXPO_PUBLIC_API_URL (voir ci-dessous)
npx expo start
```

Scanner le QR code avec **Expo Go** (téléphone réel) ou appuyer sur `a` (émulateur Android).

> **URL de l'API** : sur un téléphone réel, `localhost` désigne le téléphone lui-même. Utilisez l'IP de votre PC sur le Wi-Fi (`ipconfig`), p. ex. `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api`, et autorisez le port 3000 dans le pare-feu Windows.

Notifications push, photo de profil et export nécessitent parfois un *development build* (`eas build --profile development`) : Expo Go ne couvre pas tout (push notamment depuis le SDK 53).

## Scripts

| Commande | Rôle |
|---|---|
| `npx expo start` | Serveur de développement |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (calculs, dates, récurrences, CSV, traductions) |
| `npx expo-doctor` | Diagnostic des dépendances |
| `eas build --profile preview --platform android` | APK de test |

## Architecture

```
src/
├── app/            Écrans (Expo Router) : (tabs)/ = Accueil, Mouvements, Budget, Analyses ;
│                   feuilles : transaction, envelope, goal, contribute ; settings, (auth)/…
├── components/     UI : ui.tsx (primitives + ressorts), motion.tsx (montants animés, guilloché),
│                   charts.tsx (jauges/anneaux/barres animés), TabBar, Keypad, Toast…
├── lib/
│   ├── db.ts           SQLite (schéma versionné via PRAGMA user_version) + préférences (table meta)
│   ├── repo.ts         Lecture/écriture locale + file d'envoi (outbox) + hook useStore()
│   ├── sync.ts         Envoi (push) puis réception (pull) vers l'API
│   ├── api.ts          Client HTTP : jetons dans SecureStore, refresh automatique sur 401
│   ├── auth.tsx        Session (ouvre l'app hors ligne avec le profil en cache)
│   ├── recurring.ts    Transactions récurrentes (logique pure, testée)
│   ├── calculations.ts Moteur budgétaire (soldes, santé, rapport annuel)
│   └── …               i18n (fr/en), devise, PIN, notifications locales, export CSV/PDF
└── theme/          Couleurs sombre/clair
```

### Synchronisation (offline-first)

1. Toute modification écrit **d'abord en local** et ajoute une entrée dans `outbox` (une seule entrée par enregistrement : la dernière opération gagne).
2. Au premier plan, au retour du réseau, après chaque modification (1,5 s) et toutes les 5 min : `push` de l'outbox par lots, puis `pull` incrémental (curseur serveur).
3. Conflits : *last-write-wins* sur `updated_at` (horloge client plafonnée côté serveur). Une modification locale non encore envoyée n'est jamais écrasée par un `pull`.
4. Suppressions : *tombstones* (`deleted_at`) propagées aux autres appareils.
5. **Récurrences** : les occurrences d'un mois ont un identifiant déterministe (uuid v5 du groupe + mois) → deux appareils hors ligne ne créent pas de doublons.

### Sécurité

- Jetons (access + refresh) dans `expo-secure-store` (Keychain / Keystore).
- Code PIN : hash SHA-256 salé dans SecureStore, verrouillage après 5 essais (60 s), reverrouillage après 30 s en arrière-plan.
- À la déconnexion, la base locale est effacée (avec avertissement s'il reste des modifications non synchronisées).

## Design

Identité « billet de banque » : encre (`#0F1626`) et papier (`#EDF0EA`), un seul accent laiton, vert pour les entrées, corail pour les sorties. Polices : Bricolage Grotesque (montants, titres) et Figtree (interface). Signature : le motif guilloché tracé derrière le « Reste à dépenser ». Les animations répondent aux actions (pression, glisser pour supprimer, jauges, montants qui défilent, toast « Annuler ») et respectent le réglage « réduire les animations » du système. Tokens dans `src/theme/theme.tsx`.

## Générer l'APK (Android)

L'API de production est déjà configurée dans `eas.json` (`EXPO_PUBLIC_API_URL`). Le fichier `.env` n'est **pas** envoyé à EAS : tout ce dont l'APK a besoin doit être dans `eas.json` ou dans les variables EAS.

Une seule fois :

```bash
cd mobile
npx eas-cli init     # crée le projet EAS : choisir le compte, puis il écrit extra.eas.projectId dans app.json
# Suivi des crashs dans l'APK (le DSN n'est pas un secret, mais il reste hors du dépôt) :
npx eas-cli env:create --name EXPO_PUBLIC_SENTRY_DSN --value "<votre DSN>" --environment preview --visibility plaintext
```

Puis, à chaque APK :

```bash
npm run build:apk    # = eas build --platform android --profile preview
```

À la première build, EAS propose de **générer un keystore** : répondez oui, et conservez-le (il signe toutes les futures mises à jour). Au bout de 10 à 20 minutes, EAS fournit un lien et un QR code pour télécharger l'`.apk` et l'installer sur le téléphone (autoriser les sources inconnues).

- `preview` : APK installable directement, pour tester.
- `production` (`npm run build:aab`) : bundle `.aab` pour le Google Play Store (compte développeur à 25 $ une fois).
- Les notifications push serveur fonctionnent dans cet APK (Expo Go ne le permet pas) ; les rappels locaux fonctionnent partout.
- Le plan gratuit de Render endort l'API après inactivité : l'app la réveille dès son ouverture (délai de réponse de 60 s), mais la toute première connexion peut être lente.
- Permissions Android : réseau, notifications, vibration et accès aux photos (avatar) seulement. Micro et superposition d'écran sont bloqués.

## Écrans de toutes tailles

`src/theme/layout.ts` (`useLayout()`) distingue petits téléphones (< 360 px), écrans bas (< 700 px) et tablettes (≥ 600 px) :
grands titres et montants mis à l'échelle, colonne de contenu centrée (640 px max) sur tablette, pavé numérique, code PIN et mascotte redimensionnés,
grilles de 4 à 6 colonnes, barre de navigation bornée. Le zoom de texte d'accessibilité est respecté mais plafonné (×1,6, ×1,2 pour les montants).

## Suivi des crashs (Sentry)

Tout passe par `src/lib/monitoring.ts` (changer d'outil = modifier ce seul fichier).

1. Créer un projet **React Native** sur sentry.io et copier le DSN dans `.env` : `EXPO_PUBLIC_SENTRY_DSN=...`.
2. Dans `app.json`, remplacer `VOTRE-ORGANISATION-SENTRY` par le slug de l'organisation.
3. Pour des piles d'appels lisibles (source maps) : créer un jeton Sentry, `eas secret:create --name SENTRY_AUTH_TOKEN --value ...`,
   puis retirer `SENTRY_DISABLE_AUTO_UPLOAD` de `eas.json`.

Ce qui est remonté : crashs JS et natifs, erreurs de rendu (écran de secours avec Sou et bouton « Réessayer »), échecs de synchronisation, taux de sessions sans crash, temps d'affichage des écrans.
Ce qui ne l'est jamais : email, montants, libellés, corps de requêtes, logs console, captures d'écran. Seul l'identifiant interne du compte est attaché.

## Pas encore fait

- Connexion Google (l'API la supporte déjà : `POST /auth/google` avec un `id_token`).
- Icônes / splash personnalisés (ceux du template Expo sont encore en place).
- Notifications push serveur : nécessitent un projet EAS (`eas init`) pour obtenir un `projectId`.
