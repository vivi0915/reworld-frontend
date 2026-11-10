import { ApiError, apiError, database, currentMember, json, readBody, requireMember } from "@/lib/member-auth";
import { chooseReward } from '@/lib/role-rewards';
import { guestSession, settings } from '@/lib/operations';

const roles = ["高級牛馬", "摸魚大師", "畫餅充飢", "人生勝利組"] as const;
type Role = (typeof roles)[number];

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const db = database();
    const { results: records } = await db.prepare("SELECT id, role, reward, created_at AS createdAt FROM reward_draws WHERE member_id = ? ORDER BY created_at DESC, id DESC LIMIT 30").bind(member.id).all();
    const stats = await db.prepare("SELECT count(*) AS total FROM reward_draws WHERE member_id = ?").bind(member.id).first();
    const favorite = await db.prepare("SELECT role FROM reward_draws WHERE member_id = ? GROUP BY role ORDER BY count(*) DESC, max(id) DESC LIMIT 1").bind(member.id).first();
    return json({ records, total: stats?.total ?? 0, favoriteRole: favorite?.role ?? null });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const payload = await readBody(request);
    const system = await settings();
    if (!system.card_draw_enabled) throw new ApiError(403, system.maintenance_message || 'CARD DRAW OFFLINE');
    const member = await currentMember(request);
    const role = payload.role as Role;
    if (!roles.includes(role)) throw new ApiError(400, "請選擇有效角色。");
    const guest = await guestSession(request);
    const headers = { 'Set-Cookie': guest.cookie };
    if (!guest.established) return json({ error: '請允許 Cookie，並再次點選抽獎。' }, 428, headers);
    const db = database();
    const now = Date.now(), expires = now + 3 * 60 * 60 * 1000;
    const claim = crypto.randomUUID(), reward = chooseReward();
    const reserve = db.prepare(`INSERT INTO draw_cooldowns(session_id, claim_token, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET claim_token = excluded.claim_token, expires_at = excluded.expires_at
      WHERE draw_cooldowns.expires_at <= ?`).bind(guest.id, claim, expires, now);
    const insert = member
      ? db.prepare(`INSERT INTO reward_draws(member_id, member_name, role, reward)
          SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM draw_cooldowns WHERE session_id = ? AND claim_token = ?)
          RETURNING id, role, reward, created_at AS createdAt`).bind(member.id, member.displayName, role, reward, guest.id, claim)
      : db.prepare(`INSERT INTO guest_draws(id, session_id, role, reward)
          SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM draw_cooldowns WHERE session_id = ? AND claim_token = ?)
          RETURNING id, role, reward, created_at AS createdAt`).bind(claim, guest.id, role, reward, guest.id, claim);
    // D1 batch is transactional: a failed draw also rolls back the reservation.
    const results = await db.batch<Record<string, unknown>>([
      reserve, insert,
      db.prepare('SELECT expires_at FROM draw_cooldowns WHERE session_id = ?').bind(guest.id),
    ]);
    const record = results[1].results[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((Number(results[2].results[0].expires_at) - now) / 1000));
    if (!record) return json({
      error: `同一瀏覽器每 3 小時只能抽一次，請約 ${Math.ceil(retryAfterSeconds / 60)} 分鐘後再試。`,
      retryAfterSeconds,
    }, 429, { ...headers, 'Retry-After': String(retryAfterSeconds) });
    return json({ record: { ...record, saved: Boolean(member) }, retryAfterSeconds }, 201, headers);
  } catch (error) { return apiError(error); }
}
