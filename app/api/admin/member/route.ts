import { ApiError, apiError, database, json, memberColumns, readBody } from '@/lib/member-auth';
import { audit, requireAdmin } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const id = new URL(request.url).searchParams.get('id');
    const db = database();
    const member = await db.prepare(`SELECT ${memberColumns} FROM members m WHERE id = ?`).bind(id).first();
    if (!member) throw new ApiError(404, 'PLAYER NOT FOUND');
    const history = await db.prepare('SELECT id, type, value, created_at FROM player_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(id).all();
    const draws = await db.prepare('SELECT id, role, reward, used, created_at FROM reward_draws WHERE member_id = ? ORDER BY created_at DESC LIMIT 100').bind(id).all();
    const claims = await db.prepare('SELECT id, reward_key, status, created_at, claimed_at, redeemed_at FROM reward_claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(id).all();
    return json({ member, history: history.results, draws: draws.results, claims: claims.results });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const admin = await requireAdmin(request);
    if (typeof body.id !== 'string' || !['active', 'suspended'].includes(String(body.status))) throw new ApiError(400, '狀態不正確。');
    const db = database();
    const target = await db.prepare('SELECT access_role FROM members WHERE id = ?').bind(body.id).first<{ access_role: string }>();
    if (!target) throw new ApiError(404, 'PLAYER NOT FOUND');
    if (target.access_role === 'admin') throw new ApiError(403, '管理員帳號請由維護者管理。');
    await db.batch([
      db.prepare('UPDATE members SET status = ? WHERE id = ?').bind(body.status, body.id),
      db.prepare('DELETE FROM member_sessions WHERE member_id = ?').bind(body.id),
      audit(admin.id, `Player ${body.id} ${body.status === 'suspended' ? 'SUSPEND' : 'UNSUSPEND'}`),
    ]);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
