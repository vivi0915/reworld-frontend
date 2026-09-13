// Optional, read-only checks against a running local preview. Password registration
// was retired in favor of OTP; full isolated auth coverage lives in operations.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
const origin = process.env.TEST_ORIGIN ?? 'http://127.0.0.1:5173';
test('legacy registration is retired and Guest cannot query protected records', { skip: process.env.RUN_MEMBER_API_TESTS !== '1' }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname), 'Use a local preview only');
  const registration = await fetch(origin + '/api/member/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(registration.status, 410);
  assert.equal((await fetch(origin + '/api/draws')).status, 401);
  assert.equal((await fetch(origin + '/api/admin/members')).status, 401);
});
