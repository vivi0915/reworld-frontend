import { ApiError, apiError, createSession, database, json, rateLimit, readBody } from '@/lib/member-auth';
import { normalizePhone, otpHash, smsConfiguration } from '@/lib/otp';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const phone = normalizePhone(body.phone);
    if (typeof body.challengeId !== 'string' || body.challengeId.length > 64 || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new ApiError(400, '請輸入六位數驗證碼。');
    const config = smsConfiguration();
    await rateLimit(request, phone, 'otp-verify');
    const hash = await otpHash(body.challengeId, phone, body.code, config.secret);
    const db = database();
    // One atomic update increments attempts and consumes a correct code exactly once.
    const challenge = await db.prepare('UPDATE otp_challenges SET attempts = attempts + 1, consumed = CASE WHEN code_hash = ? THEN 1 ELSE 0 END WHERE id = ? AND phone = ? AND expires_at > ? AND attempts < 5 AND consumed = 0 AND sent = 1 RETURNING consumed').bind(hash, body.challengeId, phone, Date.now()).first<{ consumed: number }>();
    if (!challenge?.consumed) throw new ApiError(400, '驗證碼錯誤、已失效或超過嘗試次數，請重新取得。');
    const id = crypto.randomUUID();
    const playerId = 'RW-' + id.replaceAll('-', '').toUpperCase();
    // Existing unverified contact phone numbers never establish account ownership.
    await db.prepare("INSERT INTO members(id, username, display_name, phone, password_hash, player_id, phone_verified) SELECT ?, ?, 'PLAYER', ?, '', ?, 1 FROM system_settings WHERE id = 1 AND registration_enabled = 1 ON CONFLICT DO NOTHING").bind(id, 'phone_' + id, phone, playerId).run();
    const member = await db.prepare('SELECT id FROM members WHERE phone = ? AND phone_verified = 1').bind(phone).first<{ id: string }>();
    if (!member) throw new ApiError(403, 'REGISTRATION OFFLINE');
    return json({ ok: true, status: 'IDENTITY VERIFIED' }, 200, { 'Set-Cookie': await createSession(request, member.id) });
  } catch (error) { return apiError(error); }
}
