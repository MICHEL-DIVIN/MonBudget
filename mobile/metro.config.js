// Configuration Metro avec Sentry : identifiants de debug pour relier les crashs au code source (source maps).
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// L'ErrorBoundary de l'app signale déjà l'erreur : pas d'enveloppe automatique (sinon doublons).
module.exports = getSentryExpoConfig(__dirname, { autoWrapExpoRouterErrorBoundary: false });
