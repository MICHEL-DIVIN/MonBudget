// Lance une build EAS sans Git (EAS_NO_VCS=1) : les fichiers envoyés sont définis par .easignore.
// Usage : node scripts/eas-build.mjs <profil>   (preview = APK, production = .aab Play Store)
// Fonctionne de la même façon dans PowerShell, cmd, macOS et Linux.
import { spawnSync } from 'node:child_process';

const profile = process.argv[2] ?? 'preview';
const result = spawnSync('npx', ['eas-cli@latest', 'build', '--platform', 'android', '--profile', profile], {
  stdio: 'inherit', // garde les questions interactives (keystore…)
  shell: true,
  env: { ...process.env, EAS_NO_VCS: '1' },
});
process.exit(result.status ?? 1);
