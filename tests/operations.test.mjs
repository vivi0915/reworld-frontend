import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

// Real API handlers and SQL run against an isolated in-memory SQLite database.
// The SMS transport is test-injected; production has no OTP bypass.
const sql = new DatabaseSync(':memory:');
sql.exec('PRAGMA foreign_keys = ON');
for (const file of ['0000_salty_lilith.sql', '0001_previous_millenium_guard.sql']) sql.exec(readFileSync('drizzle/' + file, 'utf8'));
sql.prepare("INSERT INTO members(id, username, display_name, phone, password_hash) VALUES ('legacy', 'legacy', 'Existing', '0912345678', '')").run();
sql.exec(readFileSync('drizzle/0002_player_operations.sql', 'utf8'));
const DB = {
  prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) ?? null; },
      async all() { return { results: sql.prepare(query).all(...args) }; },
      async run() { return { meta: sql.prepare(query).run(...args) }; },
      execute() { return { results: sql.prepare(query).all(...args) }; },
    };
  },
  async batch(statements) { sql.exec('BEGIN'); try { const result = statements.map(s => s.execute()); sql.exec('COMMIT'); return result; } catch (error) { sql.exec('ROLLBACK'); throw error; } },
};
const sent = [];
globalThis.__reworldTestEnv = { DB, OTP_SECRET: 'test-only-secret-with-at-least-32-characters', SMS: { async fetch(url, options) { sent.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); } } };
const directory = '.sites-runtime/operations-tests'; mkdirSync(directory, { recursive: true });
const routes = {};
for (const name of ['system', 'access', 'draws', 'member', 'member/login', 'member/register', 'member/logout', 'member/otp/send', 'member/otp/verify', 'player/history', 'admin/settings', 'admin/dashboard', 'admin/members', 'admin/member', 'admin/logs']) {
  const output = `${directory}/${name.replaceAll('/', '-')}.mjs`;
  await build({ entryPoints: [`app/api/${name}/route.ts`], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'test-cloudflare', setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'test' })); b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const env = globalThis.__reworldTestEnv;' })); } }] });
  routes[name] = await import(pathToFileURL(process.cwd() + '/' + output));
}
after(() => { sql.close(); rmSync(directory, { recursive: true, force: true }); delete globalThis.__reworldTestEnv; });
let ip = 0;
async function call(route, method = 'GET', body, cookie = '', origin = 'https://reworld.test') {
  const [name] = route.split('?');
  const response = await routes[name][method](new Request('https://reworld.test/api/' + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'cf-connecting-ip': `test-ip-${ip++}` }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function otp(phone) {
  const send = await call('member/otp/send', 'POST', { phone }); assert.equal(send.status, 200, JSON.stringify(send.data));
  return { phone, challengeId: send.data.challengeId, code: sent.at(-1).message.match(/\d{6}/)[0] };
}
let player, admin;
test('Guest / Player / Admin flows, preservation, security and operational controls', async () => {
  assert.equal(sql.prepare("SELECT display_name FROM members WHERE id = 'legacy'").get().display_name, 'Existing');
  assert.equal((await call('system')).data.settings.door_pin, undefined);
  assert.equal((await call('access', 'GET').catch(() => ({ status: 405 }))).status, 405);
  assert.equal((await call('access', 'POST', {})).status, 403);
  assert.equal((await call('admin/settings')).status, 401);
  const missing = globalThis.__reworldTestEnv.SMS; delete globalThis.__reworldTestEnv.SMS;
  assert.equal((await call('member/otp/send', 'POST', { phone: '0911111111' })).status, 503);
  globalThis.__reworldTestEnv.SMS = missing;
  assert.equal((await call('member/otp/send', 'POST', { phone: '123' })).status, 400);
  const credentials = await otp('0912345678');
  assert.equal((await call('member/otp/send', 'POST', { phone: credentials.phone })).status, 429);
  assert.equal((await call('member/otp/verify', 'POST', { ...credentials, code: credentials.code === '000000' ? '111111' : '000000' })).status, 400);
  const verified = await call('member/otp/verify', 'POST', credentials); assert.equal(verified.status, 200);
  assert.match(verified.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax.*Max-Age=7776000.*Secure/);
  player = verified.cookie;
  assert.equal((await call('member/otp/verify', 'POST', credentials)).status, 400);
  const member = (await call('member', 'GET', undefined, player)).data.member;
  assert.notEqual(member.id, 'legacy'); assert.equal(member.phoneVerified, 1); assert.match(member.playerId, /^RW-/);
  assert.equal((await call('admin/settings', 'GET', undefined, player)).status, 403);
  assert.equal((await call('member', 'PATCH', { displayName: 'PLAYER', phone: '0999999999' }, player)).data.member.phone, '+886912345678');
  assert.equal((await call('player/history', 'POST', { type: 'class', value: '高級牛馬' }, player)).status, 201);
  assert.equal((await call('player/history', 'GET', undefined, player)).data.history.length, 1);
  assert.equal((await call('draws', 'POST', { role: '高級牛馬', memberId: 'legacy' }, player)).data.record.saved, true);
  assert.equal((await call('draws', 'POST', { role: '摸魚大師' })).data.record.saved, false);
  const adminCredentials = await otp('0922222222'); admin = (await call('member/otp/verify', 'POST', adminCredentials)).cookie;
  const adminId = (await call('member', 'GET', undefined, admin)).data.member.id;
  sql.prepare("UPDATE members SET access_role = 'admin' WHERE id = ?").run(adminId);
  assert.equal((await call('admin/settings', 'PATCH', { door_access_enabled: true, door_pin: '827364' }, admin, 'https://evil.test')).status, 403);
  assert.equal((await call('admin/settings', 'PATCH', { door_access_enabled: true, door_pin: '827364' }, admin)).status, 200);
  const access = await call('access', 'POST', {}); assert.equal(access.data.pin, '827364'); assert.equal(access.data.seconds, 15); assert.equal(access.headers.get('cache-control'), 'no-store');
  assert.equal((await call('access', 'POST', {}, player)).status, 200);
  const accessLogs = (await call('admin/logs?type=access', 'GET', undefined, admin)).data.logs;
  assert.ok(accessLogs.some(x => x.user_id === null && x.session_id)); assert.ok(accessLogs.some(x => x.user_id === member.id));
  assert.ok(!JSON.stringify((await call('admin/settings', 'GET', undefined, admin)).data).includes('827364'));
  assert.ok(!JSON.stringify((await call('admin/logs', 'GET', undefined, admin)).data).includes('827364'));
  assert.ok(!JSON.stringify((await call('system')).data).includes('827364'));
  assert.equal((await call('admin/settings', 'PATCH', { store_online: false, maintenance_message: 'PRIVATE EVENT' }, admin)).status, 200);
  assert.equal((await call('access', 'POST', {})).data.error, 'SYSTEM OFFLINE');
  assert.equal((await call('draws', 'POST', { role: '高級牛馬' })).status, 201);
  await call('admin/settings', 'PATCH', { store_online: true, door_access_enabled: false, card_draw_enabled: false, registration_enabled: false }, admin);
  assert.equal((await call('access', 'POST', {})).status, 403);
  assert.equal((await call('draws', 'POST', { role: '高級牛馬' })).status, 403);
  assert.equal((await call('member/otp/send', 'POST', { phone: '0933333333' })).status, 403);
  sql.exec('DELETE FROM otp_limits');
  const same = await otp('0912345678'); const login = await call('member/otp/verify', 'POST', same); assert.equal(login.status, 200);
  assert.equal((await call('member', 'GET', undefined, login.cookie)).data.member.id, member.id);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM members WHERE phone_verified = 1 AND phone = ?').get('+886912345678').n, 1);
  const found = await call('admin/members?q=0912345678', 'GET', undefined, admin);
  assert.ok(found.data.members.some(x => x.id === 'legacy'));
  assert.equal((await call('admin/member?id=' + member.id, 'GET', undefined, admin)).data.draws.length, 1);
  const stats = (await call('admin/dashboard', 'GET', undefined, admin)).data.stats; assert.equal(stats.accessToday, 2); assert.equal(stats.drawsToday, 3);
  await call('admin/member', 'PATCH', { id: member.id, status: 'suspended' }, admin);
  assert.equal((await call('draws', 'GET', undefined, login.cookie)).status, 401);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM member_sessions WHERE member_id = ?').get(member.id).n, 0);
  await call('admin/member', 'PATCH', { id: member.id, status: 'active' }, admin);
  await call('admin/settings', 'PATCH', { door_access_enabled: true, door_pin: null, registration_enabled: true }, admin);
  assert.equal((await call('access', 'POST', {})).status, 403);
  assert.equal((await call('member/register', 'POST', {})).status, 410);
  const bad = await otp('0944444444');
  for (let i = 0; i < 5; i++) assert.equal((await call('member/otp/verify', 'POST', { ...bad, code: bad.code === '000000' ? '111111' : '000000' })).status, 400);
  assert.equal((await call('member/otp/verify', 'POST', bad)).status, 400);
  const expired = await otp('0955555555'); sql.prepare('UPDATE otp_challenges SET expires_at = 0 WHERE id = ?').run(expired.challengeId);
  assert.equal((await call('member/otp/verify', 'POST', expired)).status, 400);
  const concurrent = await otp('0966666666');
  const attempts = await Promise.all([call('member/otp/verify', 'POST', concurrent), call('member/otp/verify', 'POST', concurrent)]);
  assert.deepEqual(attempts.map(x => x.status).sort(), [200, 400]);
});
