import { apiError, database, json } from '@/lib/member-auth';
import { guestSession } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    const guest = await guestSession(request);
    const now = Date.now();
    const row = await database().prepare('SELECT expires_at FROM draw_cooldowns WHERE session_id = ?').bind(guest.id).first<{expires_at:number}>();
    return json({ retryAfterSeconds: Math.max(0, Math.ceil(((row?.expires_at ?? 0) - now) / 1000)) }, 200, { 'Set-Cookie': guest.cookie });
  } catch (error) { return apiError(error); }
}
