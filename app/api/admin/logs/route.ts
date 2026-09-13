import { apiError, database, json } from '@/lib/member-auth';
import { requireAdmin } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const page = Math.max(0, Math.min(10000, Number(params.get('page')) || 0));
    const access = params.get('type') === 'access';
    const query = access ? 'SELECT id, user_id, session_id, accessed_at, result FROM door_access_logs ORDER BY accessed_at DESC, id DESC' : 'SELECT id, admin_id, action, created_at FROM admin_logs ORDER BY created_at DESC, id DESC';
    const { results } = await database().prepare(query + ' LIMIT 51 OFFSET ?').bind(Math.floor(page) * 50).all();
    return json({ logs: results.slice(0, 50), hasMore: results.length > 50 });
  } catch (error) { return apiError(error); }
}
