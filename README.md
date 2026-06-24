# Mon Budget Familial

Application PWA de gestion de budget familial — dark theme premium, offline-first, synchronisée avec Supabase.

## Fonctionnalités

### Budget mensuel
- **Solde en temps réel** — balance revenus/dépenses du mois avec score de santé (A à F)
- **Enveloppes budget** — catégories avec montant alloué, progression et restant (Courses, Cadeau, Loisirs, Shopping...)
- **Transactions récurrentes** — salaire, loyer, abonnements auto-générés chaque mois
- **Budget quotidien** — montant restant par jour calculé dynamiquement

### Revenus & Dépenses
- **CRUD complet** — ajouter, modifier, supprimer des transactions
- **Catégorisation** — revenus principaux/secondaires, dépenses fixes/variables
- **Types de revenus** — salaire, freelance, immobilier, allocation, autre
- **Recherche & filtres** — barre de recherche + filtres par catégorie
- **Groupement par date** — "Aujourd'hui", "Hier", date complète

### Objectifs d'épargne
- **Création d'objectifs** — montant cible + date limite
- **Suivi de progression** — barre de progression avec pourcentage
- **Ajout de fonds** — contributions manuelles vers chaque objectif

### Synthèse annuelle
- **6 KPIs** — revenus totaux, dépenses, épargne nette, taux d'épargne, revenu moyen, mois actifs
- **Graphiques** — barres revenus vs dépenses, épargne cumulée, répartition fixes/variables
- **Tableau mensuel** — récapitulatif mois par mois avec statut (Sain/Limite/Déficit)
- **Performance enveloppes** — adhérence au budget annuel par catégorie
- **Export PDF** — rapport annuel formaté généré avec jsPDF

### Profil & Paramètres
- **Photo de profil** — upload depuis galerie/caméra, sauvegarde en base64
- **Devise dynamique** — EUR, USD, GBP, XOF, XAF, CAD, CHF — changement instantané
- **Notifications** — toggles push, alertes budget, rapport hebdomadaire
- **Sécurité** — changement de mot de passe
- **Export/Import** — CSV + PDF + import de relevés bancaires CSV
- **Guide d'utilisation** — 7 sections avec instructions détaillées
- **FAQ** — 7 questions avec accordéons
- **Contact support** — email, WhatsApp, formulaire de bug

### Authentification
- **Email + mot de passe** — inscription avec confirmation par email
- **Google OAuth** — connexion en un clic
- **Protection des routes** — middleware Next.js, redirection automatique
- **Profil auto-créé** — à la première connexion
- **Déconnexion** — avec confirmation et nettoyage des données locales

### PWA & Offline
- **Installable** — manifest.webmanifest, icônes SVG 192x192 / 512x512
- **Service Worker** — cache-first pour assets, network-first pour API
- **Offline-first** — IndexedDB comme store principal, sync automatique
- **File de synchronisation** — mutations enqueued quand offline, replay au retour online

## Stack technique

| Technologie | Version | Rôle |
|------------|---------|------|
| Next.js | 16.2.9 | Framework React avec App Router |
| React | 19.2.4 | UI |
| TypeScript | 5.x | Typage |
| Tailwind CSS | 4.x | Styling (CSS-first, @theme inline) |
| Supabase | @supabase/supabase-js | Auth + PostgreSQL + Real-time |
| idb | 8.x | IndexedDB (offline storage) |
| uuid | 14.x | Génération d'IDs |
| jsPDF | 4.x | Export PDF |
| Material Symbols | - | Icônes (Google Fonts) |
| Inter | - | Police (next/font/google) |

## Structure du projet

```
monbudget/
├── app/
│   ├── layout.tsx                    # Root layout (providers: Auth, Offline, Currency, Theme, Toast)
│   ├── page.tsx                      # Onboarding wizard (4 étapes)
│   ├── manifest.ts                   # PWA manifest
│   ├── globals.css                   # Design system dark theme
│   ├── (auth)/
│   │   ├── layout.tsx                # Layout auth (centré, sans nav)
│   │   ├── login/page.tsx            # Connexion (email + Google)
│   │   └── signup/page.tsx           # Inscription (nom + email + mdp + Google)
│   ├── (app)/
│   │   ├── layout.tsx                # App shell (ClientOnly + DataInitializer + AppShell)
│   │   ├── dashboard/page.tsx        # Tableau de bord
│   │   ├── revenus/page.tsx          # Gestion des revenus
│   │   ├── depenses/page.tsx         # Gestion des dépenses + enveloppes
│   │   ├── objectifs/page.tsx        # Objectifs d'épargne
│   │   ├── synthese/page.tsx         # Synthèse annuelle
│   │   └── profil/page.tsx           # Paramètres & profil
│   └── _components/
│       ├── layout/                   # TopBar, BottomNav, Sidebar, FAB, AppShell
│       ├── ui/                       # Button, Card, Input, Select, Modal, BottomSheet, Toast, etc.
│       ├── charts/                   # DonutChart, PieChart, BarChart, TrendChart, MonthSelector
│       └── budget/                   # EnvelopeCard, TransactionRow, KPICard, AddTransactionForm, etc.
├── lib/
│   ├── auth/provider.tsx             # AuthProvider (Supabase Auth)
│   ├── supabase/client.ts            # Client Supabase
│   ├── supabase/types.ts             # Types TypeScript (Profile, Revenu, Depense, Envelope, Objectif)
│   ├── offline/
│   │   ├── db.ts                     # IndexedDB setup (idb)
│   │   ├── sync.ts                   # Sync queue (enqueue + process + pull)
│   │   ├── hooks.ts                  # useOfflineData, useOnlineStatus
│   │   ├── provider.tsx              # OfflineProvider
│   │   ├── useInitData.ts            # Bootstrap données depuis Supabase
│   │   └── recurring.ts             # Auto-génération transactions récurrentes
│   ├── currency/provider.tsx         # CurrencyProvider (7 devises)
│   ├── theme/provider.tsx            # ThemeProvider (dark/light/system)
│   └── utils/
│       ├── calculations.ts           # Moteur budgétaire (snapshots, santé, rapports)
│       ├── format.ts                 # Formatage dates/montants
│       └── exportPdf.ts             # Génération PDF avec jsPDF
├── middleware.ts                     # Protection des routes (session Supabase)
├── public/
│   ├── sw.js                         # Service Worker
│   ├── icon-192x192.svg             # Icône PWA
│   └── icon-512x512.svg             # Icône PWA maskable
└── supabase/
    ├── migration.sql                 # Création des tables
    ├── update-colors.sql             # Mise à jour couleurs enveloppes
    └── auth-rls.sql                  # Row Level Security avec auth.uid()
```

## Installation

### Prérequis
- Node.js 18+
- Compte Supabase (gratuit)

### 1. Cloner et installer

```bash
git clone <repo-url>
cd monbudget
npm install
```

### 2. Configurer Supabase

Créez un projet sur [supabase.com](https://supabase.com), puis :

```bash
cp .env.local.example .env.local
```

Remplissez `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
```

### 3. Créer les tables

Dans Supabase Dashboard > SQL Editor, exécutez :
```sql
-- Copiez le contenu de supabase/migration.sql
```

### 4. Activer l'authentification

1. Supabase Dashboard > Authentication > Providers
2. Activer **Email** (activé par défaut)
3. Pour **Google** :
   - Créez un projet dans [Google Cloud Console](https://console.cloud.google.com)
   - APIs & Services > Credentials > Create OAuth 2.0 Client ID
   - Authorized redirect URI : `https://votre-projet.supabase.co/auth/v1/callback`
   - Copiez Client ID + Secret dans Supabase > Auth > Providers > Google

### 5. Appliquer les RLS

Dans SQL Editor, exécutez :
```sql
-- Copiez le contenu de supabase/auth-rls.sql
```

### 6. Lancer

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint |

## Design

- **Thème** : Dark premium (#0a0a0f), accent violet (#8b5cf6)
- **Police** : Inter (Google Fonts, self-hosted)
- **Icônes** : Material Symbols Outlined
- **Inspiration** : Wallet, Revolut, N26
- **Mobile-first** : bottom nav 5 onglets, FAB avec choix revenu/dépense
- **Desktop** : sidebar 264px, layout 2 colonnes

## Architecture offline-first

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   React UI  │────▶│  IndexedDB   │────▶│   Supabase   │
│  (hooks)    │◀────│  (idb lib)   │◀────│  (PostgreSQL) │
└─────────────┘     └──────────────┘     └──────────────┘
                         │                       │
                    Lecture/écriture         Sync queue
                    instantanée           (network-first)
```

1. L'UI lit/écrit dans IndexedDB via `useOfflineData()`
2. Chaque mutation est enqueued dans `sync_queue`
3. Quand online, `processQueue()` pousse vers Supabase
4. `pullFromSupabase()` récupère les données fraîches
5. Résolution de conflits : last-write-wins (`updated_at`)

## Licence

Projet privé — tous droits réservés.
