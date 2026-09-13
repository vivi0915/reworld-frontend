import { ApiError, database, digest, requireMember } from './member-auth';

export type PublicSettings = {
  store_online: number; door_access_enabled: number; card_draw_enabled: number;
  registration_enabled: number; maintenance_message: string; door_pin_display_seconds: number;
};
export const publicSettingsColumns = 'store_online, door_access_enabled, card_draw_enabled, registration_enabled, maintenance_message, door_pin_display_seconds';
export async function settings() {
  const value = await database().prepare(`SELECT ${publicSettingsColumns} FROM system_settings WHERE id = 1`).first<PublicSettings>();
  if (!value) throw new ApiError(503, 'SYSTEM UNAVAILABLE');
  return value;
}
export async function requireAdmin(request: Request) {
  const member = await requireMember(request);
  if (member.accessRole !== 'admin') throw new ApiError(403, 'ACCESS DENIED');
  return member;
}
export function audit(adminId: string, action: string) {
  return database().prepare('INSERT INTO admin_logs(id, admin_id, action) VALUES (?, ?, ?)').bind(crypto.randomUUID(), adminId, action);
}
export async function guestSession(request: Request) {
  const candidate = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('reworld_guest='))?.slice(14);
  const token = candidate && /^[a-f0-9]{64}$/.test(candidate) ? candidate : Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { id: await digest(token), cookie: `reworld_guest=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}` };
}
export const playerRoles = ['高級牛馬', '摸魚大師', '畫餅充飢', '人生勝利組'];
