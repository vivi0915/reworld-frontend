import { ApiError, apiError, createSession, database, digest, hashPassword, json, password, rateLimit, readBody } from '@/lib/member-auth';

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const secret = password(body.password);
    if (secret !== body.confirmPassword) throw new ApiError(400, '兩次輸入的密碼不一致。');
    if (typeof body.setupToken !== 'string' || body.setupToken.length !== 72 || typeof body.challengeId !== 'string' || body.challengeId.length > 64) throw new ApiError(400, '請先完成手機驗證。');
    await rateLimit(request, body.challengeId, 'password-setup');
    const hashed = await hashPassword(secret);
    const db = database();
    // A one-use proof is bound to the verified phone and purpose, never client phone input.
    const proof = await db.prepare("UPDATE otp_challenges SET recovery_hash = NULL WHERE id = ? AND user_id IS NULL AND purpose IN ('register','recover') AND consumed = 1 AND sent = 1 AND recovery_hash = ? AND expires_at > ? RETURNING phone, purpose").bind(body.challengeId, await digest(body.setupToken), Date.now()).first<{ phone: string; purpose: string }>();
    if (!proof) throw new ApiError(400, '驗證憑證已失效，請重新取得簡訊驗證碼。');
    let owner: { id: string } | null;
    if (proof.purpose === 'register') {
      const id = crypto.randomUUID();
      owner = await db.prepare("INSERT INTO members(id, username, display_name, phone, password_hash, player_id, phone_verified, phone_verified_at) SELECT ?, ?, '會員', ?, ?, ?, 1, CURRENT_TIMESTAMP FROM system_settings WHERE id = 1 AND registration_enabled = 1 ON CONFLICT DO NOTHING RETURNING id").bind(id, 'phone_' + id, proof.phone, hashed, 'RW-' + id.replaceAll('-', '').toUpperCase()).first<{ id: string }>();
      if (!owner) throw new ApiError(409, '此手機已註冊或註冊暫停，請登入或稍後再試。');
    } else {
      owner = await db.prepare("UPDATE members SET password_hash = ? WHERE phone = ? AND phone_verified_at IS NOT NULL AND status = 'active' RETURNING id").bind(hashed, proof.phone).first<{ id: string }>();
      if (!owner) throw new ApiError(403, '無法重設此帳號的密碼。');
      await db.prepare('DELETE FROM member_sessions WHERE member_id = ?').bind(owner.id).run();
    }
    return json({ ok: true, status: proof.purpose === 'register' ? '註冊完成' : '密碼已重設' }, 200, { 'Set-Cookie': await createSession(request, owner.id) });
  } catch (error) { return apiError(error); }
}
