// Run against the local preview: RUN_MEMBER_API_TESTS=1 node --test tests/member-api.test.mjs
// Synthetic accounts are identified by test_run_<timestamp>; cleanup SQL is
// written into .sites-runtime after completion, never touching real accounts.
import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const origin = process.env.TEST_ORIGIN ?? "http://127.0.0.1:5173";
const run = `test_${Date.now()}`;
const names = [`${run}a`, `${run}b`];
const password = "local-test-password-123!";
async function call(path, method = "GET", body, cookie = "", extraHeaders = {}) {
  const response = await fetch(origin + path, { method, headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { error: text }; }
  return { status: response.status, data, cookie: response.headers.get("set-cookie"), cache: response.headers.get("cache-control") };
}
test("members: registration, isolation, profile, login, logout and authorization", { skip: process.env.RUN_MEMBER_API_TESTS !== "1" }, async () => {
  try {
    assert.equal((await call("/api/member")).data.member, null);
    assert.equal((await call("/api/draws")).status, 401);
    assert.equal((await call("/api/member/register", "POST", { username: names[0], password, displayName: "測試會員" }, "", { Origin: "https://untrusted.example" })).status, 403);
    assert.equal((await call("/api/member/register", "POST", { username: names[0], password: "short", displayName: "測試會員" })).status, 400);
    const a = await call("/api/member/register", "POST", { username: names[0], password, displayName: "測試會員甲", accessRole: "admin" });
    assert.equal(a.status, 201, JSON.stringify(a.data));
    assert.match(a.cookie, /HttpOnly/); assert.match(a.cookie, /SameSite=Lax/);
    assert.equal(a.cache, "no-store");
    const cookieA = a.cookie.split(";")[0];
    assert.equal((await call("/api/member/register", "POST", { username: names[0].toUpperCase(), password, displayName: "重複" })).status, 409);
    const profileA = (await call("/api/member", "GET", undefined, cookieA)).data.member;
    assert.equal(profileA.accessRole, "member");
    assert.equal(profileA.passwordHash, undefined);
    assert.equal((await call("/api/admin/members", "GET", undefined, cookieA)).status, 403);
    const b = await call("/api/member/register", "POST", { username: names[1], password, displayName: "測試會員乙" });
    assert.equal(b.status, 201);
    const cookieB = b.cookie.split(";")[0];
    const profileB = (await call("/api/member", "GET", undefined, cookieB)).data.member;
    const update = await call("/api/member", "PATCH", { displayName: "修改暱稱", phone: "0912345678", email: "test@example.com", accessRole: "admin", id: profileB.id }, cookieA);
    assert.equal(update.status, 200);
    assert.equal(update.data.member.accessRole, "member");
    assert.equal((await call("/api/member", "GET", undefined, cookieB)).data.member.displayName, "測試會員乙");
    const draw = await call("/api/draws", "POST", { role: "法師", memberId: profileB.id, memberName: "冒用" }, cookieA);
    assert.equal(draw.status, 201);
    assert.equal((await call(`/api/draws?memberId=${profileA.id}`, "GET", undefined, cookieB)).data.records.length, 0);
    const historyA = (await call("/api/draws", "GET", undefined, cookieA)).data;
    assert.equal(historyA.total, 1); assert.equal(historyA.favoriteRole, "法師");
    assert.equal((await call("/api/draws", "POST", { role: "其他" }, cookieA)).status, 400);
    assert.equal((await call("/api/member/login", "POST", { username: names[0], password: "wrong-password-123" })).status, 401);
    assert.equal((await call("/api/member/logout", "POST", undefined, cookieA)).status, 200);
    assert.equal((await call("/api/draws", "GET", undefined, cookieA)).status, 401);
    const login = await call("/api/member/login", "POST", { username: names[0], password });
    assert.equal(login.status, 200);
    const newCookie = login.cookie.split(";")[0];
    assert.notEqual(newCookie, cookieA);
    const saved = (await call("/api/member", "GET", undefined, newCookie)).data.member;
    assert.equal(saved.displayName, "修改暱稱"); assert.equal(saved.phone, "0912345678");
    assert.equal((await call("/api/draws", "GET", undefined, newCookie)).data.total, 1);
    for (let attempt = 0; attempt < 9; attempt++) await call("/api/member/login", "POST", { username: names[0], password: "wrong-password-123" });
    assert.equal((await call("/api/member/login", "POST", { username: names[0], password })).status, 429);
  } finally {
    const list = names.map(name => `'${name}'`).join(",");
    await writeFile(".sites-runtime/cleanup-member-tests.sql", `DELETE FROM reward_draws WHERE member_id IN (SELECT id FROM members WHERE username IN (${list}));\nDELETE FROM members WHERE username IN (${list});\n`);
  }
});
