import { apiError, database, json } from '@/lib/member-auth';
import { requireAdmin } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const stats = await database().prepare(`SELECT
      (SELECT count(*) FROM members) AS membersTotal,
      (SELECT count(*) FROM members WHERE date(created_at, '+8 hours') = date('now', '+8 hours')) AS membersToday,
      (SELECT count(*) FROM door_access_logs WHERE date(accessed_at, '+8 hours') = date('now', '+8 hours') AND result = 'granted') AS accessToday,
      ((SELECT count(*) FROM reward_draws WHERE date(created_at, '+8 hours') = date('now', '+8 hours')) + (SELECT count(*) FROM guest_draws WHERE date(created_at, '+8 hours') = date('now', '+8 hours'))) AS drawsToday`).first();
    return json({ stats });
  } catch (error) { return apiError(error); }
}
