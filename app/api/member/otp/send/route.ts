import { ApiError, apiError, currentMember, database, json, readBody } from '@/lib/member-auth';
import { normalizePhone, otpHash, otpSendLimit, smsConfiguration } from '@/lib/otp';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const phone = normalizePhone(body.phone);
    const member = await currentMember(request);
    const purpose = body.purpose;
    if (purpose !== 'attach' && purpose !== 'recover') throw new ApiError(400, '請選擇驗證或恢復 PLAYER。');
    if (purpose === 'attach' && !member) throw new ApiError(401, '請先建立 PLAYER。');
    if (purpose === 'attach' && member?.phoneVerifiedAt) throw new ApiError(409, '此 PLAYER 已驗證手機。');
    const config = smsConfiguration();
    await otpSendLimit(request, phone, member?.id);
    const id = crypto.randomUUID();
    // Rejection sampling avoids modulo bias.
    let number: number;
    do { number = crypto.getRandomValues(new Uint32Array(1))[0]; } while (number >= 4294000000);
    const code = String(number % 1000000).padStart(6, '0');
    const db = database();
    await db.batch([
      db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE phone = ?').bind(phone),
      db.prepare('INSERT INTO otp_challenges(id, phone, code_hash, expires_at, user_id, purpose) VALUES (?, ?, ?, ?, ?, ?)').bind(id, phone, await otpHash(id, phone, code, config.secret), Date.now() + 300000, member?.id ?? null, purpose),
    ]);
    let delivered = false;
    try {
      const response = await config.sms.fetch('https://sms.internal/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: phone, message: `REWORLD 驗證碼：${code}。5 分鐘內有效，請勿提供給他人。`, idempotencyKey: id }), signal: AbortSignal.timeout(10000) });
      delivered = response.ok;
    } catch { /* Never log provider responses or OTP. */ }
    if (!delivered) {
      await db.prepare('UPDATE otp_challenges SET consumed = 1 WHERE id = ?').bind(id).run();
      throw new ApiError(503, '簡訊暫時無法發送，請稍後再試。');
    }
    await db.prepare('UPDATE otp_challenges SET sent = 1 WHERE id = ?').bind(id).run();
    return json({ challengeId: id, expiresIn: 300, resendAfter: 60 });
  } catch (error) { return apiError(error); }
}
