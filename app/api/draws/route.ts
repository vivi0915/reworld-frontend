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
    const reward = chooseReward();
    if (!member) {
      const guest = await guestSession(request);
      const id = crypto.randomUUID();
      await database().prepare('INSERT INTO guest_draws(id, session_id, role, reward) VALUES (?, ?, ?, ?)').bind(id, guest.id, role, reward).run();
      return json({ record: { id, role, reward, createdAt: new Date().toISOString(), saved: false } }, 201, { 'Set-Cookie': guest.cookie });
    }
    const record = await database().prepare("INSERT INTO reward_draws (member_id, member_name, role, reward) VALUES (?, ?, ?, ?) RETURNING id, role, reward, created_at AS createdAt").bind(member.id, member.displayName, role, reward).first();
    return json({ record: { ...record, saved: true } }, 201);
  } catch (error) { return apiError(error); }
}
