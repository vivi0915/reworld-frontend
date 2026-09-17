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
sql.exec("INSERT INTO member_sessions VALUES('preserved-session','legacy',9999999999999); INSERT INTO player_history(id,user_id,type,value) VALUES('preserved-history','legacy','class','高級牛馬'); INSERT INTO reward_claims(id,user_id,reward_key,status,claimed_at) VALUES('preserved-claim','legacy','old-reward','claimed',CURRENT_TIMESTAMP);");
sql.exec("INSERT INTO members(id,username,display_name,phone,password_hash,access_role,player_id,phone_verified) VALUES('verified-existing','verified-existing','Existing Verified','+886988888888','preserved-password-hash','admin','RW-EXISTING',1);");
sql.exec(readFileSync('drizzle/0005_optional_phone_player.sql', 'utf8'));
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
for (const name of ['system', 'access', 'draws', 'member', 'member/login', 'member/register', 'member/logout', 'member/otp/send', 'member/otp/verify', 'member/otp/restore', 'player/create', 'rewards/claim', 'player/history', 'admin/settings', 'admin/dashboard', 'admin/members', 'admin/member', 'admin/logs']) {
  const output = `${directory}/${name.replaceAll('/', '-')}.mjs`;
  await build({ entryPoints: [`app/api/${name}/route.ts`], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'test-cloudflare', setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'test' })); b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const env = globalThis.__reworldTestEnv;' })); } }] });
  routes[name] = await import(pathToFileURL(process.cwd() + '/' + output));
}
after(() => { sql.close(); rmSync(directory, { recursive: true, force: true }); delete globalThis.__reworldTestEnv; });
let ip = 0;
async function call(route, method = 'GET', body, cookie = '', origin = 'https://reworld.test', fixedIp) {
  const [name] = route.split('?');
  const response = await routes[name][method](new Request('https://reworld.test/api/' + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, 'cf-connecting-ip': fixedIp ?? `test-ip-${ip++}` }, ...(body ? { body: JSON.stringify(body) } : {}) }));
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function create() {
  const response = await call('player/create', 'POST', {});
  assert.equal(response.status, 201, JSON.stringify(response.data));
  return response.cookie;
}
async function otp(phone, cookie = '', purpose = cookie ? 'attach' : 'recover') {
  const send = await call('member/otp/send', 'POST', { phone, purpose }, cookie);
  assert.equal(send.status, 200, JSON.stringify(send.data));
  return { phone, challengeId: send.data.challengeId, code: sent.at(-1).message.match(/\d{6}/)[0] };
}
const member = async cookie => (await call('member', 'GET', undefined, cookie)).data.member;
const grant = (id, user, key) => sql.prepare("INSERT INTO reward_claims(id,user_id,reward_key) VALUES(?,?,?)").run(id, user, key);
test('Guest → Player → Verified Player, recovery, rewards and existing operations', async () => {
  assert.equal(sql.prepare("SELECT display_name FROM members WHERE id='legacy'").get().display_name, 'Existing');
  assert.equal(sql.prepare("SELECT count(*) n FROM member_sessions WHERE member_id='legacy'").get().n, 1);
  assert.equal(sql.prepare("SELECT count(*) n FROM player_history WHERE user_id='legacy'").get().n, 1);
  assert.equal(sql.prepare("SELECT status FROM reward_claims WHERE id='preserved-claim'").get().status, 'claimed');
  assert.equal(sql.prepare("SELECT count(*) n FROM reward_claim_locks WHERE user_id='legacy'").get().n, 1);
  assert.equal(sql.prepare("PRAGMA foreign_key_check").all().length, 0);
  const migrated = sql.prepare("SELECT * FROM members WHERE id='verified-existing'").get();
  assert.equal(migrated.password_hash,'preserved-password-hash'); assert.equal(migrated.access_role,'admin'); assert.equal(migrated.phone,'+886988888888'); assert.ok(migrated.phone_verified_at);
  assert.equal((await call('admin/settings')).status, 401);
  assert.equal((await call('player/create', 'POST', {}, '', 'https://evil.test')).status, 403);
  const sms = globalThis.__reworldTestEnv.SMS; delete globalThis.__reworldTestEnv.SMS;
  let player = await create();
  const before = await member(player);
  assert.equal(before.phone, null); assert.equal(before.phoneVerifiedAt, null); assert.equal(before.phoneVerified, 0); assert.match(before.playerId, /^RW-/);
  assert.equal((await call('player/create', 'POST', {}, player)).status, 200);
  assert.equal((await member(player)).id, before.id);
  assert.equal((await call('member/otp/send', 'POST', {phone:'0912345678', purpose:'attach'}, player)).status, 503);
  assert.equal((await call('player/history', 'POST', {type:'class',value:'高級牛馬'}, player)).status, 201);
  assert.equal((await call('draws', 'POST', {role:'高級牛馬',memberId:'legacy'}, player)).data.record.saved, true);
  assert.equal((await call('draws', 'POST', {role:'摸魚大師'})).data.record.saved, false);
  globalThis.__reworldTestEnv.SMS = sms;
  const admin = await create(); const adminId = (await member(admin)).id;
  sql.prepare("UPDATE members SET access_role='admin' WHERE id=?").run(adminId);
  assert.equal((await call('admin/settings', 'GET', undefined, player)).status, 403);
  await call('admin/settings', 'PATCH', {door_access_enabled:true,door_pin:'827364'}, admin);
  for (const cookie of ['', player]) { const result=await call('access','POST',{},cookie); assert.equal(result.data.pin,'827364'); assert.equal(result.headers.get('cache-control'),'no-store'); }
  sql.exec("INSERT INTO reward_definitions VALUES('physical-menu',1,1),('digital-badge',0,1)");
  grant('menu-a', before.id, 'physical-menu'); grant('badge-a', before.id, 'digital-badge');
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-a'},player)).data.code,'PHONE_VERIFICATION_REQUIRED');
  assert.equal((await call('rewards/claim','POST',{claimId:'badge-a'},player)).status,200);
  assert.equal((await call('rewards/claim','POST',{claimId:'badge-a'},player)).status,409);
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-a'})).status,401);
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-a'},admin)).status,404);
  assert.equal((await call('rewards/claim','POST',{claimId:'invented',requires_phone_verification:false},player)).status,404);
  assert.equal((await call('member/otp/send','POST',{phone:'123',purpose:'attach'},player)).status,400);
  assert.equal((await call('member/otp/send','POST',{phone:'0912345678',purpose:'attach'})).status,401);
  const proof = await otp('0912345678', player);
  assert.equal((await call('member/otp/send','POST',{phone:proof.phone,purpose:'attach'},player)).status,429);
  assert.equal((await call('member/otp/verify','POST',proof,admin)).status,400);
  assert.equal((await call('member/otp/verify','POST',{...proof,code:proof.code==='000000'?'111111':'000000'},player)).status,400);
  const verify=await call('member/otp/verify','POST',proof,player);assert.equal(verify.status,200); const originalSession=player; player=verify.cookie;
  assert.match(verify.headers.get('set-cookie'),/HttpOnly.*SameSite=Lax.*Max-Age=7776000.*Secure/);
  assert.equal((await call('member/otp/verify','POST',proof,player)).status,400);
  const verified=await member(player);assert.equal(verified.id,before.id);assert.equal(verified.playerId,before.playerId);assert.ok(verified.phoneVerifiedAt);assert.equal(verified.phoneVerified,1);assert.equal(verified.phone,'+886912345678');
  assert.equal(await member(originalSession),null);
  assert.equal((await call('player/history','GET',undefined,player)).data.history.length,1);
  assert.equal((await call('draws','GET',undefined,player)).data.records.length,1);
  assert.equal((await call('access','POST',{},player)).status,200);
  assert.equal((await call('member','PATCH',{displayName:'PLAYER',phone:'0999999999'},player)).data.member.phone,verified.phone);
  const claims=await Promise.all([call('rewards/claim','POST',{claimId:'menu-a'},player),call('rewards/claim','POST',{claimId:'menu-a'},player)]);
  assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
  grant('menu-a-again',before.id,'physical-menu');assert.equal((await call('rewards/claim','POST',{claimId:'menu-a-again'},player)).status,409);
  const second=await create();const secondId=(await member(second)).id;grant('menu-b',secondId,'physical-menu');
  sql.exec('DELETE FROM otp_limits');const duplicate=await otp('0912345678',second);
  const conflict=await call('member/otp/verify','POST',duplicate,second);assert.equal(conflict.status,409);assert.equal(conflict.data.error,'PLAYER ALREADY EXISTS');assert.ok(conflict.data.restoreToken);
  assert.equal((await member(second)).phoneVerifiedAt,null);
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-b'},second)).status,403);
  assert.equal(sql.prepare('SELECT count(*) n FROM members WHERE phone=? AND phone_verified_at IS NOT NULL').get(verified.phone).n,1);
  const restoreBody={challengeId:duplicate.challengeId,restoreToken:conflict.data.restoreToken};
  assert.equal((await call('member/otp/restore','POST',restoreBody,admin)).status,400);
  const restored=await call('member/otp/restore','POST',restoreBody,second);assert.equal(restored.status,200);assert.equal((await member(restored.cookie)).id,before.id);
  assert.equal((await call('member/otp/restore','POST',restoreBody,restored.cookie)).status,400);
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-a-again'},restored.cookie)).status,409);
  assert.equal((await call('rewards/claim','POST',{claimId:'menu-b'},restored.cookie)).status,404);
  await call('admin/settings','PATCH',{store_online:false,registration_enabled:false},admin);
  const unverified=await member(admin);assert.equal(unverified.phoneVerifiedAt,null);
  for(const cookie of ['',admin,player]) assert.equal((await call('access','POST',{},cookie)).status,403);
  assert.equal((await call('player/create','POST',{})).status,403);
  sql.exec('DELETE FROM otp_limits');const recovery=await otp('0912345678');const login=await call('member/otp/verify','POST',recovery);assert.equal(login.status,200);assert.equal((await member(login.cookie)).id,before.id);
  assert.equal((await call('player/history','GET',undefined,login.cookie)).data.claims.find(c=>c.id==='menu-a').status,'claimed');
  const newPhone=await otp('0922222222');assert.equal((await call('member/otp/verify','POST',newPhone)).status,404);
  assert.equal(sql.prepare("SELECT count(*) n FROM members WHERE phone='+886922222222'").get().n,0);
  // Verification of existing unverified Players remains available with registration off.
  const adminProof=await otp('0933333333',admin);assert.equal((await call('member/otp/verify','POST',adminProof,admin)).status,200);
  const activeAdmin=(await call('member/otp/verify','POST',adminProof,admin));assert.equal(activeAdmin.status,400);
  // Continue using an independent valid admin session for operation checks.
  sql.exec('DELETE FROM otp_limits');const adminRecovery=await otp('0933333333');const adminLogin=(await call('member/otp/verify','POST',adminRecovery)).cookie;
  const found=await call('admin/members?q=0912345678','GET',undefined,adminLogin);assert.ok(found.data.members.some(m=>m.id===before.id));
  const detail=await call('admin/member?id='+before.id,'GET',undefined,adminLogin);assert.equal(detail.data.member.phoneVerifiedAt,verified.phoneVerifiedAt);assert.equal(detail.data.draws.length,1);assert.ok(detail.data.claims.some(c=>c.id==='menu-a'));
  for(const route of ['system','admin/settings','admin/logs']) assert.ok(!JSON.stringify((await call(route,'GET',undefined,adminLogin)).data).includes('827364'));
  await call('admin/member','PATCH',{id:before.id,status:'suspended'},adminLogin);assert.equal(await member(login.cookie),null);assert.equal(sql.prepare('SELECT count(*) n FROM member_sessions WHERE member_id=?').get(before.id).n,0);
  sql.exec('DELETE FROM otp_limits');const suspended=await otp('0912345678');assert.equal((await call('member/otp/verify','POST',suspended)).status,403);
  await call('admin/member','PATCH',{id:before.id,status:'active'},adminLogin);
  await call('admin/settings','PATCH',{store_online:true,door_access_enabled:false,card_draw_enabled:false,registration_enabled:true},adminLogin);
  assert.equal((await call('access','POST',{})).status,403);assert.equal((await call('draws','POST',{role:'高級牛馬'})).status,403);
  await call('admin/settings','PATCH',{door_access_enabled:true,door_pin:null},adminLogin);assert.equal((await call('access','POST',{})).status,403);
  assert.equal((await call('member/register','POST',{})).status,410);
  const bad=await otp('0944444444');for(let i=0;i<5;i++) assert.equal((await call('member/otp/verify','POST',{...bad,code:bad.code==='000000'?'111111':'000000'})).status,400);assert.equal((await call('member/otp/verify','POST',bad)).status,400);
  const expired=await otp('0955555555');sql.prepare('UPDATE otp_challenges SET expires_at=0 WHERE id=?').run(expired.challengeId);assert.equal((await call('member/otp/verify','POST',expired)).status,400);
  const limitPlayer=await create();
  for(let i=0;i<10;i++) assert.equal((await call('member/otp/send','POST',{phone:'09700000'+String(i).padStart(2,'0'),purpose:'attach'},limitPlayer)).status,200);
  assert.equal((await call('member/otp/send','POST',{phone:'0970000010',purpose:'attach'},limitPlayer)).status,429);
  for(let i=0;i<10;i++) assert.equal((await call('player/create','POST',{},'', 'https://reworld.test','fixed-create-ip')).status,201);
  assert.equal((await call('player/create','POST',{},'', 'https://reworld.test','fixed-create-ip')).status,429);
  sql.exec('DELETE FROM otp_limits');const race=await otp('0912345678');const races=await Promise.all([call('member/otp/verify','POST',race),call('member/otp/verify','POST',race)]);assert.deepEqual(races.map(r=>r.status).sort(),[200,400]);
});
