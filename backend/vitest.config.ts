import { defineConfig } from 'vitest/config';

// Tests unitaires de logique pure (pas de base de données). Le test de bout en bout est test/smoke.mjs.
export default defineConfig({
  test: { include: ['src/**/*.spec.ts'] },
});
