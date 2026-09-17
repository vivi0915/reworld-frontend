import { ApiError, apiError, createSession, database, digest, json, readBody, requireMember } from '@/lib/member-auth';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const current = await requireMember(request);
    if (typeof body.restoreToken !== 'string' || body.restoreToken.length !== 72 || typeof body.challengeId !== 'string' || body.challengeId.length > 64) throw new ApiError(400, '恢復憑證無效。');
    const db = database();
    const proof = await db.prepare('UPDATE otp_challenges SET recovery_hash = NULL WHERE id = ? AND user_id = ? AND consumed = 1 AND recovery_hash = ? AND expires_at > ? RETURNING phone').bind(body.challengeId, current.id, await digest(body.restoreToken), Date.now()).first<{ phone: string }>();
    if (!proof) throw new ApiError(400, '恢復憑證已失效，請重新驗證。');
    const owner = await db.prepare('SELECT id FROM members WHERE phone = ? AND phone_verified_at IS NOT NULL').bind(proof.phone).first<{ id: string }>();
    if (!owner) throw new ApiError(404, 'PLAYER NOT FOUND');
    return json({ ok: true, status: 'PLAYER RESTORED' }, 200, { 'Set-Cookie': await createSession(request, owner.id) });
  } catch (error) { return apiError(error); }
}
