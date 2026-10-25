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


test('exploration permissions, confirmation, revocation and one-time voucher on real D1', async () => {
  const server = path.resolve('dist/server');
  const entrypoint = path.join(server,'index.js');
  const files = await modules(server);
  const worker = new Miniflare({
    modulesRoot:server, modules:[{type:'ESModule',path:entrypoint},...files.filter(file=>file.path!==entrypoint)],
    compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],cf:false,
    serviceBindings:{ASSETS:()=>new Response('Not found',{status:404})},
  });
  try {
    const db=await worker.getD1Database('DB');
    for (const file of ['0000_salty_lilith.sql','0001_previous_millenium_guard.sql','0002_player_operations.sql','0005_optional_phone_player.sql','0006_menu_exploration.sql']) {
      const migration=await readFile(path.join('drizzle',file),'utf8');
      await db.batch(migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
    }
    let ip=0;
    async function call(route,method='GET',body,cookie='',origin='http://localhost') {
      const response=await worker.dispatchFetch('http://localhost/api/'+route,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'cf-connecting-ip':'test-'+ip++},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
    }
    const create=async()=>{ const id=crypto.randomUUID(), token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''); const hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex'); await db.prepare("INSERT INTO members(id,username,display_name,password_hash,player_id) VALUES(?,?,'Legacy fixture','',?)").bind(id,id,'RW-'+id).run();await db.prepare('INSERT INTO member_sessions VALUES(?,?,?)').bind(hash,id,Date.now()+86400000).run();return 'reworld_session='+token; };
    const cookie=await create(), other=await create(), staff=await create();
    const identity=async c=>(await call('member','GET',undefined,c)).data.member;
    const member=await identity(cookie), otherMember=await identity(other), admin=await identity(staff);
    await db.prepare("UPDATE members SET access_role='admin' WHERE id=?").bind(admin.id).run();
    const get=async c=>(await call('menu/exploration','GET',undefined,c)).data;
    const choose=async (id,c=cookie)=>call('menu/exploration','POST',{drinkId:id,memberId:otherMember.id,status:'completed'},c);
    const ids=['01','02','04','03'].flatMap(role=>[1,2,3].map(n=>'role-'+role+'-drink-'+n));
    const edit=async (action,id,revision,extra={})=>call('admin/exploration','PATCH',{memberId:member.id,action,drinkId:id,revision,...extra},staff);
    assert.equal((await call('menu/exploration')).status,401);
    assert.equal((await choose(ids[0],'')).status,401);
    assert.equal((await call('admin/exploration?memberId='+member.id,'GET',undefined,cookie)).status,403);
    assert.equal((await call('admin/exploration','PATCH',{memberId:member.id,action:'confirm',drinkId:ids[0],revision:1},cookie)).status,403);
    assert.equal((await choose('invalid')).status,400);
    assert.equal((await call('menu/exploration','POST',{drinkId:ids[0]},cookie,'https://foreign.test')).status,403);
    const first=await choose(ids[0]);
    assert.equal(first.status,200);assert.equal(first.data.completed,0);
    assert.equal(first.data.records[0].status,'pending');
    assert.equal((await choose(ids[0])).data.records.length,1);
    assert.equal((await get(other)).records.length,0);
    assert.equal((await call('menu/exploration?memberId='+member.id,'GET',undefined,other)).data.memberId,otherMember.id);
    const concurrent=await Promise.all([edit('confirm',ids[0],1),edit('confirm',ids[0],1)]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
    let progress=await get(cookie);
    assert.equal(progress.completed,1);assert.ok(progress.records[0].confirmedAt);
    assert.equal(progress.records[0].confirmedBy,admin.id);
    const date=progress.records[0].confirmedAt;
    assert.equal((await choose(ids[0])).data.completed,1);
    assert.equal((await get(cookie)).records[0].confirmedAt,date);
    for (const id of ids.slice(1)) {
      await choose(id);assert.equal((await edit('confirm',id,1)).status,200);
    }
    progress=await get(cookie);
    assert.equal(progress.completed,12);assert.equal(progress.voucher.eligible,true);
    const code=progress.voucher.code;
    assert.equal((await edit('revoke',ids[0],2)).status,400);
    assert.equal((await edit('revoke',ids[0],2,{reason:'Wrong drink confirmed'})).status,200);
    progress=await get(cookie);
    assert.equal(progress.completed,11);assert.equal(progress.voucher.eligible,false);
    assert.equal((await edit('redeem',undefined,undefined,{code})).status,409);
    assert.equal((await edit('confirm',ids[0],1)).status,409);
    await choose(ids[0]);progress=await get(cookie);
    const revision=progress.records.find(r=>r.drinkId===ids[0]).revision;
    assert.equal((await edit('confirm',ids[0],revision)).status,200);
    assert.equal((await get(cookie)).voucher.code,code);
    const redeemed=await Promise.all([edit('redeem',undefined,undefined,{code}),edit('redeem',undefined,undefined,{code})]);
    assert.deepEqual(redeemed.map(r=>r.status).sort(),[200,409]);
    assert.ok((await get(cookie)).voucher.redeemedAt);
    assert.equal((await db.prepare("SELECT count(*) n FROM admin_logs WHERE action LIKE 'Menu voucher REDEEM%'").first()).n,1);
    assert.equal((await edit('revoke',ids[0],revision+1,{reason:'Post-redemption correction'})).status,200);
    await choose(ids[0]);
    assert.equal((await edit('confirm',ids[0],revision+3)).status,200);
    assert.equal((await edit('redeem',undefined,undefined,{code})).status,409);
    assert.equal((await db.prepare('SELECT count(*) n FROM menu_vouchers WHERE member_id=?').bind(member.id).first()).n,1);
    const detail=await call('admin/exploration?memberId='+member.id,'GET',undefined,staff);
    assert.equal(detail.status,200);
    assert.equal(detail.data.events.filter(event=>event.action==='revoke').length,2);
    assert.ok(detail.data.events.every(event=>event.actor===admin.username));
    assert.equal((await call('menu/exploration','GET',undefined,cookie)).headers.get('cache-control'),'no-store');
    await db.prepare("UPDATE members SET display_name='Menu Test Member' WHERE id=?").bind(member.id).run();
    assert.ok((await call('admin/members?q=Menu%20Test','GET',undefined,staff)).data.members.some(m=>m.id===member.id));
    await call('member/logout','POST',{},cookie);
    assert.equal((await call('menu/exploration','GET',undefined,cookie)).status,401);
    assert.equal((await get(other)).completed,0);
  } finally { await worker.dispose(); }
});
