import { ApiError, apiError, database, json, memberColumns, requireMember } from "@/lib/member-auth";
export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    if (member.accessRole !== "admin") throw new ApiError(403, "只有店家管理員可以查看會員名單。");
    const rawPage = Number(new URL(request.url).searchParams.get("page") ?? 0);
    const page = Number.isInteger(rawPage) && rawPage >= 0 ? Math.min(rawPage, 10000) : 0;
    const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 64);
    const normalized = /^09\d{8}$/.test(q) ? '+886' + q.slice(1) : q;
    const { results } = await database().prepare(`SELECT ${memberColumns}, (SELECT count(*) FROM reward_draws r WHERE r.member_id = m.id) AS drawCount FROM members m WHERE instr(m.phone, ?) > 0 OR instr(m.phone, ?) > 0 OR instr(lower(m.player_id), lower(?)) > 0 ORDER BY m.created_at DESC, m.id LIMIT 31 OFFSET ?`).bind(q, normalized, q, page * 30).all();
    return json({ members: results.slice(0, 30), hasMore: results.length > 30 });
  } catch (error) { return apiError(error); }
}
