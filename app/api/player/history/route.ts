import { ApiError, apiError, database, json, rateLimit, readBody, requireMember } from '@/lib/member-auth';
import { playerRoles } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const { results } = await database().prepare('SELECT id, type, value, created_at FROM player_history WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 100').bind(member.id).all();
    const { results: claims } = await database().prepare('SELECT id, reward_key, status, created_at, claimed_at FROM reward_claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(member.id).all();
    return json({ history: results, claims });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const member = await requireMember(request);
    if (body.type !== 'class' || typeof body.value !== 'string' || !playerRoles.includes(body.value)) throw new ApiError(400, '請選擇有效角色。');
    await rateLimit(request, member.id, 'player-history');
    await database().prepare('INSERT INTO player_history(id, user_id, type, value) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), member.id, body.type, body.value).run();
    return json({ ok: true }, 201);
  } catch (error) { return apiError(error); }
}
