import { defineConfig } from 'vitest/config';

// Tests de logique pure (calculs, dates, récurrences, CSV) : pas besoin de React Native.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
