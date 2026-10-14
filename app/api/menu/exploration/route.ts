import { ApiError, apiError, database, json, readBody, requireMember } from '@/lib/member-auth';
import { drinkId, exploration } from '@/lib/menu-exploration';
export async function GET(request: Request) {
  try { const member = await requireMember(request); return json(await exploration(member.id)); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const member = await requireMember(request);
    if (body.expectedMemberId !== undefined && body.expectedMemberId !== member.id) throw new ApiError(409, '登入帳號已變更，請重新讀取會員資料。');
    const id = drinkId(body.drinkId);
    // A repeat selection never changes a completion or duplicates a pending request.
    await database().prepare(`INSERT INTO menu_explorations(member_id,drink_id) VALUES(?,?)
      ON CONFLICT(member_id,drink_id) DO UPDATE SET status='pending', requested_at=CURRENT_TIMESTAMP,
      confirmed_at=NULL, confirmed_by=NULL, revision=menu_explorations.revision+1, last_event_id=NULL
      WHERE menu_explorations.status='revoked'`).bind(member.id, id).run();
    return json(await exploration(member.id));
  } catch (error) { return apiError(error); }
}
