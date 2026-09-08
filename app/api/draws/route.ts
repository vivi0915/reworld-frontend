import { ApiError, apiError, database, json, readBody, requireMember } from "@/lib/member-auth";

const roles = ["法師", "射手", "打野", "戰士"] as const;
type Role = (typeof roles)[number];

const rewardPools: Record<Role, Array<{ label: string; weight: number }>> = {
  法師: [
    { label: "本次消費 9 折", weight: 20 },
    { label: "魔力 Shot 一杯", weight: 35 },
    { label: "指定調酒升級", weight: 45 },
  ],
  射手: [
    { label: "本次消費 9 折", weight: 20 },
    { label: "精準 Shot 一杯", weight: 35 },
    { label: "指定調酒升級", weight: 45 },
  ],
  打野: [
    { label: "本次消費 9 折", weight: 20 },
    { label: "隱藏 Shot 一杯", weight: 35 },
    { label: "神秘小食一份", weight: 45 },
  ],
  戰士: [
    { label: "本次消費 9 折", weight: 20 },
    { label: "勇者 Shot 一杯", weight: 35 },
    { label: "指定調酒升級", weight: 45 },
  ],
};

function chooseReward(role: Role) {
  const roll = Math.random() * 100;
  let cursor = 0;
  for (const reward of rewardPools[role]) {
    cursor += reward.weight;
    if (roll < cursor) return reward.label;
  }
  return rewardPools[role][rewardPools[role].length - 1].label;
}

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
    const member = await requireMember(request);
    const role = payload.role as Role;
    if (!roles.includes(role)) throw new ApiError(400, "請選擇有效屬性。");
    const record = await database().prepare("INSERT INTO reward_draws (member_id, member_name, role, reward) VALUES (?, ?, ?, ?) RETURNING id, role, reward, created_at AS createdAt").bind(member.id, member.displayName, role, chooseReward(role)).first();
    return json({ record }, 201);
  } catch (error) { return apiError(error); }
}
