import { ApiError, apiError, createSession, currentMember, database, digest, json, rateLimit, readBody } from '@/lib/member-auth';
import { normalizePhone, otpHash, smsConfiguration } from '@/lib/otp';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const phone = normalizePhone(body.phone);
    if (typeof body.challengeId !== 'string' || body.challengeId.length > 64 || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) throw new ApiError(400, '請輸入六位數驗證碼。');
    const config = smsConfiguration();
    const current = await currentMember(request);
    await rateLimit(request, phone, 'otp-verify');
    const hash = await otpHash(body.challengeId, phone, body.code, config.secret);
    const db = database();
    // The challenge is bound to its originating Player (or a signed-out recovery).
    const challenge = await db.prepare('UPDATE otp_challenges SET attempts = attempts + 1, consumed = CASE WHEN code_hash = ? THEN 1 ELSE 0 END WHERE id = ? AND phone = ? AND user_id IS ? AND expires_at > ? AND attempts < 5 AND consumed = 0 AND sent = 1 RETURNING consumed, purpose').bind(hash, body.challengeId, phone, current?.id ?? null, Date.now()).first<{ consumed: number; purpose: string }>();
    if (!challenge?.consumed) throw new ApiError(400, '驗證碼錯誤、已失效或不屬於此 PLAYER，請重新取得。');
    if (challenge.purpose === 'attach') {
      if (!current) throw new ApiError(401, '請先建立 PLAYER。');
      // Unique phone index resolves simultaneous claims; no account merging.
      await db.prepare("UPDATE OR IGNORE members SET phone = ?, phone_verified = 1, phone_verified_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active' AND phone_verified_at IS NULL").bind(phone, current.id).run();
    }
    const owner = await db.prepare('SELECT id, status FROM members WHERE phone = ? AND phone_verified_at IS NOT NULL').bind(phone).first<{ id: string; status: string }>();
    if (!owner) throw new ApiError(404, 'PLAYER NOT FOUND · 請先建立 PLAYER，再綁定手機。');
    if (owner.status !== 'active') throw new ApiError(403, 'PLAYER SUSPENDED');
    if (current && owner.id !== current.id) {
      // Explicit confirmation before switching accounts. Proof expires with OTP.
      const token = crypto.randomUUID() + crypto.randomUUID();
      await db.prepare('UPDATE otp_challenges SET recovery_hash = ? WHERE id = ?').bind(await digest(token), body.challengeId).run();
      return json({ error: 'PLAYER ALREADY EXISTS', restoreToken: token, challengeId: body.challengeId }, 409);
    }
    return json({ ok: true, status: challenge.purpose === 'attach' ? 'IDENTITY VERIFIED' : 'PLAYER RESTORED' }, 200, { 'Set-Cookie': await createSession(request, owner.id) });
  } catch (error) { return apiError(error); }
}
