import { ApiError, apiError, database, json, readBody } from '@/lib/member-auth';
import { audit, requireAdmin, settings } from '@/lib/operations';
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const pin = await database().prepare("SELECT CASE WHEN door_pin IS NULL OR door_pin = '' THEN 0 ELSE 1 END AS configured FROM system_settings WHERE id = 1").first();
    return json({ settings: await settings(), pinConfigured: Boolean(pin?.configured) });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const body = await readBody(request);
    const admin = await requireAdmin(request);
    const toggles = ['store_online', 'door_access_enabled', 'card_draw_enabled', 'registration_enabled'];
    const names: Record<string, string> = { store_online: 'Store', door_access_enabled: 'Door Access', card_draw_enabled: 'Card Draw', registration_enabled: 'Registration' };
    const keys = Object.keys(body);
    if (!keys.length || keys.some(key => ![...toggles, 'maintenance_message', 'door_pin', 'door_pin_display_seconds'].includes(key))) throw new ApiError(400, '設定欄位不正確。');
    const db = database();
    const statements: D1PreparedStatement[] = [];
    for (const key of keys) {
      let value = body[key];
      let action: string;
      if (toggles.includes(key)) {
        if (typeof value !== 'boolean') throw new ApiError(400, '開關必須為 ON / OFF。');
        action = `${names[key]} ${key === 'store_online' ? (value ? 'ONLINE' : 'OFFLINE') : (value ? 'ON' : 'OFF')}`;
        value = value ? 1 : 0;
      } else if (key === 'maintenance_message') {
        if (typeof value !== 'string' || value.length > 500) throw new ApiError(400, '訊息最多 500 字。');
        action = 'Maintenance Message changed';
      } else if (key === 'door_pin') {
        if (value !== null && (typeof value !== 'string' || !/^\d{4,12}$/.test(value))) throw new ApiError(400, 'Door PIN 須為 4–12 位數字，或清除設定。');
        action = 'Door PIN changed';
      } else {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 5 || value > 60) throw new ApiError(400, '顯示時間須介於 5–60 秒。');
        action = 'Door PIN display duration changed';
      }
      // key is strictly allowlisted; PIN never appears in the audit action.
      statements.push(db.prepare(`UPDATE system_settings SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).bind(value));
      statements.push(audit(admin.id, action));
    }
    await db.batch(statements);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
