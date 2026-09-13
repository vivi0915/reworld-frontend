import { apiError, currentMember, database, json, rateLimit, readBody } from '@/lib/member-auth';
import { guestSession } from '@/lib/operations';
export async function POST(request: Request) {
  try {
    await readBody(request);
    const guest = await guestSession(request);
    await rateLimit(request, guest.id, 'door-access');
    const member = await currentMember(request);
    // Read PIN only here. The conditional INSERT and following SELECT share a D1 transaction.
    const db = database();
    const id = crypto.randomUUID();
    const results = await db.batch<{ store_online: number; maintenance_message: string; pin: string | null; seconds: number }>([
      db.prepare("INSERT INTO door_access_logs(id, user_id, session_id, result) SELECT ?, ?, ?, 'granted' FROM system_settings WHERE id = 1 AND store_online = 1 AND door_access_enabled = 1 AND door_pin IS NOT NULL AND door_pin <> ''").bind(id, member?.id ?? null, guest.id),
      db.prepare("SELECT store_online, maintenance_message, CASE WHEN store_online = 1 AND door_access_enabled = 1 THEN door_pin ELSE NULL END AS pin, door_pin_display_seconds AS seconds FROM system_settings WHERE id = 1"),
    ]);
    const state = results[1].results[0];
    if (!state) return json({ error: 'ACCESS UNAVAILABLE' }, 503);
    if (!state.store_online) return json({ error: 'SYSTEM OFFLINE', message: state.maintenance_message || 'REWORLD IS CURRENTLY OFFLINE' }, 403);
    if (!state.pin) return json({ error: 'ACCESS UNAVAILABLE', message: state.maintenance_message }, 403);
    return json({ status: 'ACCESS GRANTED', pin: state.pin, seconds: state.seconds }, 200, { 'Set-Cookie': guest.cookie });
  } catch (error) { return apiError(error); }
}
