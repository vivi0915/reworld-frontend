import { ApiError, apiError, database, json, readBody } from '@/lib/member-auth';
import { requireAdmin } from '@/lib/operations';
import { drinkId, exploration } from '@/lib/menu-exploration';
import { drinks } from '@/lib/menu-catalog';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const id = new URL(request.url).searchParams.get('memberId');
    if (!id || !await database().prepare('SELECT id FROM members WHERE id=?').bind(id).first()) throw new ApiError(404, '找不到會員。');
    const progress = await exploration(id);
    const events = await database().prepare(`SELECT e.id,e.drink_id AS drinkId,e.action,e.reason,e.created_at AS createdAt,m.username AS actor
      FROM menu_exploration_events e JOIN members m ON m.id=e.actor_id WHERE e.member_id=? ORDER BY e.created_at DESC,e.rowid DESC LIMIT 100`).bind(id).all();
    return json({ ...progress, events: events.results });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const admin = await requireAdmin(request);
    if (typeof body.memberId !== 'string') throw new ApiError(400, '請指定會員。');
    const db = database();
    const target = await db.prepare('SELECT status FROM members WHERE id=?').bind(body.memberId).first<{ status: string }>();
    if (!target) throw new ApiError(404, '找不到會員。');
    if (body.action === 'redeem') {
      if (target.status !== 'active') throw new ApiError(409, '會員目前停用。');
      if (typeof body.code !== 'string') throw new ApiError(400, '請提供兌換券。');
      const changed = await db.batch([
        db.prepare(`UPDATE menu_vouchers SET redeemed_at=CURRENT_TIMESTAMP, redeemed_by=?
          WHERE member_id=? AND code=? AND redeemed_at IS NULL
          AND (SELECT count(*) FROM menu_explorations WHERE member_id=? AND status='completed')=?
          RETURNING code`).bind(admin.id, body.memberId, body.code, body.memberId, drinks.length),
        db.prepare(`INSERT INTO admin_logs(id,admin_id,action) SELECT ?,?,?
          WHERE changes()=1`).bind(crypto.randomUUID(), admin.id, `Menu voucher REDEEM member=${body.memberId}`),
      ]);
      if (!changed[0].results.length) throw new ApiError(409, '兌換券已使用或尚未集滿，請重新讀取。');
      return json(await exploration(body.memberId));
    }
    if (!['confirm','revoke'].includes(String(body.action)) || !Number.isInteger(body.revision)) throw new ApiError(400, '操作不正確。');
    const id = drinkId(body.drinkId);
    const confirm = body.action === 'confirm';
    if (confirm && target.status !== 'active') throw new ApiError(409, '會員目前停用。');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0,200) : '';
    if (!confirm && !reason) throw new ApiError(400, '請填寫撤銷原因。');
    const event = crypto.randomUUID();
    const changed = await db.batch([
      db.prepare(`UPDATE menu_explorations SET status=?,confirmed_at=${confirm ? 'CURRENT_TIMESTAMP' : 'NULL'},confirmed_by=?,
        revision=revision+1,last_event_id=? WHERE member_id=? AND drink_id=? AND status=? AND revision=? RETURNING drink_id`)
        .bind(confirm ? 'completed' : 'revoked', confirm ? admin.id : null, event, body.memberId, id, confirm ? 'pending' : 'completed', body.revision),
      db.prepare(`INSERT INTO menu_exploration_events(id,member_id,drink_id,actor_id,action,reason)
        SELECT ?,member_id,drink_id,?,?,? FROM menu_explorations WHERE last_event_id=?`).bind(event,admin.id,body.action,reason,event),
      db.prepare(`INSERT INTO admin_logs(id,admin_id,action)
        SELECT ?,?,? FROM menu_explorations WHERE last_event_id=?`).bind(crypto.randomUUID(),admin.id,`Menu ${body.action} member=${body.memberId} drink=${id} reason=${reason}`,event),
      db.prepare(`INSERT OR IGNORE INTO menu_vouchers(member_id,code)
        SELECT ?,? WHERE (SELECT count(*) FROM menu_explorations WHERE member_id=? AND status='completed')=?`)
        .bind(body.memberId,crypto.randomUUID(),body.memberId,drinks.length),
    ]);
    if (!changed[0].results.length) throw new ApiError(409, '紀錄已變更，請重新讀取後再操作。');
    return json(await exploration(body.memberId));
  } catch (error) { return apiError(error); }
}
