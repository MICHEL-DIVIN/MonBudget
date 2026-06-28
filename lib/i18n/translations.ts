export type Locale = "fr" | "en";

export const translations = {
  fr: {
    nav: { home: "Accueil", income: "Revenus", expenses: "Dépenses", savings: "Épargne", summary: "Synthèse", settings: "Réglages" },
    common: { save: "Enregistrer", cancel: "Annuler", delete: "Supprimer", add: "Ajouter", loading: "Chargement...", back: "Retour" },
    settings: {
      title: "Paramètres du compte",
      subtitle: "Gérez vos préférences personnelles et la sécurité de votre foyer.",
      account: "Compte", notifications: "Notifications", security: "Sécurité", export: "Export", install: "Installer l'app", help: "Aide",
      theme: "Thème", themeLight: "Clair", themeDark: "Sombre", themeAuto: "Auto",
      language: "Langue", currency: "Devise",
      pushNotifs: "Notifications push", budgetAlerts: "Alertes dépassement budget", weeklyReport: "Rapport hebdomadaire",
      pin: "Code PIN", pinDesc: "Verrou rapide à 4 chiffres", pinSetup: "Configurer le PIN", pinRemove: "Désactiver le PIN",
      fiscalReminders: "Rappels fiscaux", fiscalDesc: "Résumé annuel pour votre déclaration",
      exportCsv: "Export CSV", exportPdf: "Export PDF", importTx: "Importer des transactions",
      goals: "Objectifs", member: "Utilisateur",
    },
    onboarding: {
      welcome: "Bienvenue !", welcomeDesc: "Gérez votre budget familial simplement, même hors ligne.",
      currency: "Choisissez votre devise", currencyDesc: "Vous pourrez la modifier plus tard dans les réglages.",
      envelopes: "Créez votre première enveloppe", envelopesDesc: "Organisez vos dépenses par catégories (Courses, Loisirs...).",
      done: "C'est parti !", doneDesc: "Votre espace est prêt. Commencez par ajouter un revenu ou une dépense.",
      next: "Suivant", skip: "Passer", finish: "Commencer",
    },
    pin: { title: "Entrez votre code PIN", setup: "Créez un code PIN", confirm: "Confirmez le PIN", mismatch: "Les codes ne correspondent pas", unlock: "Déverrouiller" },
  },
  en: {
    nav: { home: "Home", income: "Income", expenses: "Expenses", savings: "Savings", summary: "Summary", settings: "Settings" },
    common: { save: "Save", cancel: "Cancel", delete: "Delete", add: "Add", loading: "Loading...", back: "Back" },
    settings: {
      title: "Account settings",
      subtitle: "Manage your personal preferences and household security.",
      account: "Account", notifications: "Notifications", security: "Security", export: "Export", install: "Install app", help: "Help",
      theme: "Theme", themeLight: "Light", themeDark: "Dark", themeAuto: "Auto",
      language: "Language", currency: "Currency",
      pushNotifs: "Push notifications", budgetAlerts: "Budget overspend alerts", weeklyReport: "Weekly report",
      pin: "PIN code", pinDesc: "Quick 4-digit lock", pinSetup: "Set up PIN", pinRemove: "Remove PIN",
      fiscalReminders: "Tax reminders", fiscalDesc: "Annual summary for your tax return",
      exportCsv: "Export CSV", exportPdf: "Export PDF", importTx: "Import transactions",
      goals: "Goals", member: "User",
    },
    onboarding: {
      welcome: "Welcome!", welcomeDesc: "Manage your family budget easily, even offline.",
      currency: "Choose your currency", currencyDesc: "You can change it later in settings.",
      envelopes: "Create your first envelope", envelopesDesc: "Organize spending by category (Groceries, Leisure...).",
      done: "All set!", doneDesc: "Your space is ready. Start by adding income or an expense.",
      next: "Next", skip: "Skip", finish: "Get started",
    },
    pin: { title: "Enter your PIN", setup: "Create a PIN", confirm: "Confirm PIN", mismatch: "PINs do not match", unlock: "Unlock" },
  },
} as const;

export type TranslationKey = keyof typeof translations.fr;
