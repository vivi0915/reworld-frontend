import { ApiError, apiError, createSession, database, hashPassword, json, password, rateLimit, readBody } from '@/lib/member-auth';
import { normalizePhone } from '@/lib/otp';
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const phone = normalizePhone(body.phone);
    const secret = password(body.password);
    if (secret !== body.confirmPassword) throw new ApiError(400, '兩次輸入的密碼不一致。');
    await rateLimit(request, phone, 'register');
    const db = database();
    const id = crypto.randomUUID();
    const created = await db.prepare("INSERT INTO members(id, username, display_name, phone, password_hash, player_id, phone_verified) SELECT ?, ?, '會員', ?, ?, ?, 0 FROM system_settings WHERE id = 1 AND registration_enabled = 1 AND NOT EXISTS (SELECT 1 FROM members WHERE phone = ?) ON CONFLICT DO NOTHING RETURNING id").bind(id, phone, phone, await hashPassword(secret), 'RW-' + id.replaceAll('-', '').toUpperCase(), phone).first<{ id: string }>();
    if (!created) throw new ApiError(409, '此手機已註冊或目前暫停註冊。');
    return json({ ok: true }, 200, { 'Set-Cookie': await createSession(request, id) });
  } catch (error) { return apiError(error); }
}
