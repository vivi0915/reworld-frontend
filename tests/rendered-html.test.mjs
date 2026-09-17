import assert from 'node:assert/strict';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Miniflare } from 'miniflare';

async function modules(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await modules(filename));
    else if (entry.name.endsWith('.js')) files.push({ type: 'ESModule', path: filename });
  }
  return files;
}

test('built Worker renders Guest home and protects admin routes with real D1', async () => {
  const server = path.resolve('dist/server');
  const entrypoint = path.join(server, 'index.js');
  const files = await modules(server);
  const worker = new Miniflare({
    modulesRoot: server,
    modules: [{ type: 'ESModule', path: entrypoint }, ...files.filter(file => file.path !== entrypoint)],
    compatibilityDate: '2026-05-15', compatibilityFlags: ['nodejs_compat'],
    d1Databases: ['DB'], cf: false,
    serviceBindings: { ASSETS: () => new Response('Not found', { status: 404 }) },
  });
  try {
    const db = await worker.getD1Database('DB');
    for (const file of ['0000_salty_lilith.sql', '0001_previous_millenium_guard.sql', '0002_player_operations.sql', '0005_optional_phone_player.sql']) {
      const sql = await readFile(path.join('drizzle', file), 'utf8');
      const statements = sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean);
      await db.batch(statements.map(statement => db.prepare(statement)));
    }
    const response = await worker.dispatchFetch('http://localhost/', { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.match(html, /ACCESS/); assert.match(html, /GUEST/);
    assert.doesNotMatch(html, /scrypt-v1\$|code_hash|password_hash/);
    const state = await worker.dispatchFetch('http://localhost/api/system');
    assert.equal(state.status, 200);
    const settings = await state.json();
    assert.equal(settings.settings.door_access_enabled, 0);
    assert.equal(settings.settings.door_pin, undefined);
    const access = await worker.dispatchFetch('http://localhost/api/access', { method: 'POST', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(access.status, 403);
    assert.equal((await access.json()).error, 'ACCESS UNAVAILABLE');
    assert.equal((await worker.dispatchFetch('http://localhost/api/admin/settings')).status, 401);
    const created = await worker.dispatchFetch('http://localhost/api/player/create', { method:'POST', headers:{Origin:'http://localhost','Content-Type':'application/json'},body:'{}' });
    assert.equal(created.status,201);
    const cookie = created.headers.get('set-cookie').split(';')[0];
    const identity = await worker.dispatchFetch('http://localhost/api/member',{headers:{Cookie:cookie}});
    const player = (await identity.json()).member;
    assert.equal(player.phone,null); assert.equal(player.phoneVerifiedAt,null);
    await db.batch([
      db.prepare("INSERT INTO reward_definitions VALUES('protected',1,1)"),
      db.prepare("INSERT INTO reward_claims(id,user_id,reward_key) VALUES('real-d1-claim',?,'protected')").bind(player.id),
    ]);
    const blocked = await worker.dispatchFetch('http://localhost/api/rewards/claim',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({claimId:'real-d1-claim'})});
    assert.equal(blocked.status,403); assert.equal((await blocked.json()).code,'PHONE_VERIFICATION_REQUIRED');
    await db.prepare("UPDATE members SET phone='+886911111111',phone_verified=1,phone_verified_at=CURRENT_TIMESTAMP WHERE id=?").bind(player.id).run();
    const claimRequest = () => worker.dispatchFetch('http://localhost/api/rewards/claim',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({claimId:'real-d1-claim'})});
    const claims = await Promise.all([claimRequest(),claimRequest()]);
    assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
    const admin = await worker.dispatchFetch('http://localhost/admin');
    assert.match(await admin.text(), /ACCESS DENIED/);
  } finally { await worker.dispose(); }
});
