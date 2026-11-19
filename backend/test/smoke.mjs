// Test de bout en bout contre un serveur lancé (voir README) :
//   API_URL=http://localhost:3100/api API_LOG=chemin/du/log node test/smoke.mjs
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const API = process.env.API_URL ?? 'http://localhost:3100/api';
const LOG = process.env.API_LOG;
let failures = 0;

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failures++;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* 204 */ }
  return { status: res.status, json };
}

const email = `smoke+${Date.now()}@example.com`;
const password = 'Motdepasse1';

// --- Auth ---
let r = await call('POST', '/auth/register', { body: { email, password: 'court', full_name: 'Smoke' } });
check('register: mot de passe faible refusé', r.status === 400, JSON.stringify(r.json));

r = await call('POST', '/auth/register', { body: { email, password, full_name: 'Smoke' } });
check('register OK', r.status === 201 && r.json.access_token && r.json.refresh_token, JSON.stringify(r.json));
const session = r.json;
check('register: pas de hash exposé', !JSON.stringify(r.json).includes('password_hash') && !('passwordHash' in r.json.user));

r = await call('POST', '/auth/register', { body: { email, password } });
check('register: doublon refusé (409)', r.status === 409);

r = await call('POST', '/auth/login', { body: { email, password: 'Mauvais123' } });
check('login: mauvais mot de passe (401)', r.status === 401);
r = await call('POST', '/auth/login', { body: { email: 'inconnu@example.com', password } });
check('login: compte inconnu (401, même message)', r.status === 401);
r = await call('POST', '/auth/login', { body: { email: email.toUpperCase(), password } });
check('login OK (email insensible à la casse)', r.status === 200 && r.json.access_token);

r = await call('GET', '/me');
check('me sans jeton (401)', r.status === 401);
r = await call('GET', '/me', { token: session.access_token });
check('me OK', r.status === 200 && r.json.email === email && r.json.role === 'user');

r = await call('PATCH', '/me', { token: session.access_token, body: { currency: 'XOF', full_name: 'Nouveau' } });
check('me: mise à jour devise', r.status === 200 && r.json.currency === 'XOF');
r = await call('PATCH', '/me', { token: session.access_token, body: { role: 'admin' } });
check('me: élévation de rôle impossible (400)', r.status === 400);
r = await call('PATCH', '/me', { token: session.access_token, body: { currency: 'JPY' } });
check('me: devise inconnue refusée', r.status === 400);

r = await call('GET', '/admin/stats', { token: session.access_token });
check('admin: interdit à un utilisateur (403)', r.status === 403);

// --- Refresh : rotation + détection de réutilisation ---
r = await call('POST', '/auth/refresh', { body: { refresh_token: session.refresh_token } });
check('refresh OK', r.status === 200 && r.json.refresh_token !== session.refresh_token);
const rotated = r.json;
r = await call('POST', '/auth/refresh', { body: { refresh_token: session.refresh_token } });
check('refresh: ancien token rejeté (401)', r.status === 401);
r = await call('POST', '/auth/refresh', { body: { refresh_token: rotated.refresh_token } });
check('refresh: réutilisation révoque toute la famille', r.status === 401);

r = await call('POST', '/auth/login', { body: { email, password } });
const s2 = r.json;
const token = s2.access_token;

// --- Sync ---
const envId = randomUUID();
const depId = randomUUID();
const revId = randomUUID();
const objId = randomUUID();
const t0 = new Date(Date.now() - 60_000).toISOString();
const base = { created_at: t0, updated_at: t0 };

r = await call('POST', '/sync/push', {
  token,
  body: {
    changes: [
      { store: 'envelopes', op: 'upsert', data: { id: envId, name: 'Courses', budgeted: 300, color: 'bg-env-green', icon: 'shopping_cart', sort_order: 1, ...base } },
      { store: 'depenses', op: 'upsert', data: { id: depId, label: 'Marché', amount: 42.5, category: 'variable', envelope_id: envId, date: '2026-11-03', recurring: false, ...base } },
      { store: 'revenus', op: 'upsert', data: { id: revId, label: 'Salaire', amount: 2500, category: 'principal', type: 'salaire', date: '2026-11-01', recurring: true, recurring_group_id: randomUUID(), ...base } },
      { store: 'objectifs', op: 'upsert', data: { id: objId, label: 'Vacances', target_amount: 1000, current_amount: 100, deadline: '2027-06-30', ...base } },
    ],
  },
});
check('push: 4 changements appliqués', r.status === 200 && r.json.applied === 4 && r.json.rejected.length === 0, JSON.stringify(r.json));

r = await call('GET', '/sync/pull', { token });
check('pull complet', r.status === 200 && r.json.envelopes.length === 1 && r.json.depenses.length === 1 && r.json.revenus.length === 1 && r.json.objectifs.length === 1, JSON.stringify(r.json).slice(0, 300));
check('pull: montants en nombres, dates en AAAA-MM-JJ', r.json.depenses[0].amount === 42.5 && r.json.depenses[0].date === '2026-11-03' && r.json.depenses[0].envelope_id === envId);
const cursor = r.json.server_time;

r = await call('GET', `/sync/pull?since=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`, { token });
check('pull incrémental futur: vide', r.status === 200 && r.json.depenses.length === 0);

// Conflit : un changement plus ancien ne doit pas écraser
const older = new Date(Date.now() - 3_600_000).toISOString();
r = await call('POST', '/sync/push', { token, body: { changes: [{ store: 'depenses', op: 'upsert', data: { id: depId, label: 'ANCIEN', amount: 1, category: 'variable', date: '2026-11-03', created_at: older, updated_at: older } }] } });
check('push: changement périmé ignoré (stale)', r.json.stale === 1 && r.json.applied === 0, JSON.stringify(r.json));

// Mise à jour plus récente
const newer = new Date().toISOString();
r = await call('POST', '/sync/push', { token, body: { changes: [{ store: 'depenses', op: 'upsert', data: { id: depId, label: 'Marché bio', amount: 50, category: 'variable', envelope_id: envId, date: '2026-11-03', created_at: t0, updated_at: newer } }] } });
check('push: mise à jour récente appliquée', r.json.applied === 1);
r = await call('GET', `/sync/pull?since=${encodeURIComponent(cursor)}`, { token });
check('pull incrémental: renvoie la mise à jour', r.json.depenses.length === 1 && r.json.depenses[0].label === 'Marché bio');

// Idempotence : rejouer la même requête ne duplique rien
await call('POST', '/sync/push', { token, body: { changes: [{ store: 'envelopes', op: 'upsert', data: { id: envId, name: 'Courses', budgeted: 300, ...base } }] } });
r = await call('GET', '/sync/pull', { token });
check('push rejoué: pas de doublon', r.json.envelopes.length === 1);

// Validation
r = await call('POST', '/sync/push', { token, body: { changes: [
  { store: 'depenses', op: 'upsert', data: { id: randomUUID(), label: 'Négatif', amount: -5, category: 'variable', date: '2026-11-03', ...base } },
  { store: 'depenses', op: 'upsert', data: { id: randomUUID(), label: 'Date', amount: 5, category: 'variable', date: '2026-13-45', ...base } },
  { store: 'revenus', op: 'upsert', data: { id: 'pas-un-uuid', label: 'X', amount: 5, category: 'principal', date: '2026-11-03', ...base } },
] } });
check('push: données invalides rejetées individuellement', r.status === 200 && r.json.rejected.length === 3 && r.json.applied === 0, JSON.stringify(r.json));
r = await call('POST', '/sync/push', { token, body: { changes: [{ store: 'users', op: 'upsert', data: {} }] } });
check('push: store inconnu refusé (400)', r.status === 400);

// Isolation entre utilisateurs
const other = (await call('POST', '/auth/register', { body: { email: `other+${Date.now()}@example.com`, password } })).json;
r = await call('GET', '/sync/pull', { token: other.access_token });
check('isolation: l’autre utilisateur ne voit rien', r.json.depenses.length === 0 && r.json.envelopes.length === 0);
r = await call('POST', '/sync/push', { token: other.access_token, body: { changes: [{ store: 'depenses', op: 'upsert', data: { id: depId, label: 'Vol', amount: 1, category: 'variable', date: '2026-11-03', created_at: newer, updated_at: new Date().toISOString() } }] } });
check('isolation: écrasement de la ligne d’autrui rejeté', r.json.rejected.length === 1 && r.json.applied === 0, JSON.stringify(r.json));
r = await call('POST', '/sync/push', { token: other.access_token, body: { changes: [{ store: 'depenses', op: 'delete', data: { id: depId, updated_at: new Date().toISOString() } }] } });
check('isolation: suppression de la ligne d’autrui rejetée', r.json.rejected.length === 1, JSON.stringify(r.json));

// Suppression de l'enveloppe : tombstone + dépenses détachées
const delAt = new Date().toISOString();
r = await call('POST', '/sync/push', { token, body: { changes: [{ store: 'envelopes', op: 'delete', data: { id: envId, updated_at: delAt } }] } });
check('delete enveloppe appliqué', r.json.applied === 1);
r = await call('GET', `/sync/pull?since=${encodeURIComponent(cursor)}`, { token });
const env = r.json.envelopes.find((e) => e.id === envId);
const dep = r.json.depenses.find((d) => d.id === depId);
check('pull: tombstone enveloppe (deleted_at)', env && env.deleted_at);
check('pull: dépense détachée de l’enveloppe supprimée', dep && dep.envelope_id === null);

// --- Mot de passe oublié ---
r = await call('POST', '/auth/forgot-password', { body: { email: 'inconnu@example.com' } });
check('forgot: même réponse pour un compte inconnu', r.status === 200 && r.json.ok === true);
r = await call('POST', '/auth/forgot-password', { body: { email } });
check('forgot OK', r.status === 200);
if (LOG) {
  await new Promise((res) => setTimeout(res, 500));
  const log = readFileSync(LOG, 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
  const matches = [...log.matchAll(new RegExp(`Code de réinitialisation pour ${email.replace(/[+.]/g, '\\$&')} : (\\d{6})`, 'g'))];
  const code = matches.at(-1)?.[1];
  check('forgot: code trouvé dans les logs (dev)', !!code);
  if (code) {
    const wrong = code === '000000' ? '111111' : '000000';
    r = await call('POST', '/auth/reset-password', { body: { email, code: wrong, new_password: 'Nouveau1234' } });
    check('reset: mauvais code refusé', r.status === 400);
    r = await call('POST', '/auth/reset-password', { body: { email, code, new_password: 'Nouveau1234' } });
    check('reset OK', r.status === 200);
    r = await call('POST', '/auth/reset-password', { body: { email, code, new_password: 'Autre1234567' } });
    check('reset: code à usage unique', r.status === 400);
    r = await call('POST', '/auth/login', { body: { email, password } });
    check('reset: ancien mot de passe invalide', r.status === 401);
    r = await call('POST', '/auth/login', { body: { email, password: 'Nouveau1234' } });
    check('reset: nouveau mot de passe valide', r.status === 200);
    r = await call('POST', '/auth/refresh', { body: { refresh_token: s2.refresh_token } });
    check('reset: sessions existantes révoquées', r.status === 401);
  }
}

// --- Divers ---
r = await call('POST', '/support', { token: other.access_token, body: { message: 'Bonjour, une question' } });
check('support: message créé', r.status === 201 && r.json.id);
r = await call('GET', '/notifications', { token: other.access_token });
check('notifications: liste vide', r.status === 200 && Array.isArray(r.json));
r = await call('POST', '/push/register', { token: other.access_token, body: { token: 'ExponentPushToken[abc123]', platform: 'android' } });
check('push: enregistrement', r.status === 204);
r = await call('POST', '/push/register', { token: other.access_token, body: { token: 'pas-un-token', platform: 'android' } });
check('push: jeton invalide refusé', r.status === 400);

r = await call('DELETE', '/me', { token: other.access_token, body: { password: 'Mauvais1234' } });
check('suppression compte: mauvais mot de passe refusé', r.status === 400);
r = await call('DELETE', '/me', { token: other.access_token, body: { password } });
check('suppression compte OK', r.status === 204);

console.log(failures === 0 ? '\nTOUT EST OK' : `\n${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
