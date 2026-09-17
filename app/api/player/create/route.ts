import { ApiError, apiError, createSession, currentMember, database, json, rateLimit, readBody } from '@/lib/member-auth';
export async function POST(request: Request) {
  try {
    await readBody(request);
    const current = await currentMember(request);
    if (current) return json({ ok: true, status: 'PLAYER EXISTS' });
    await rateLimit(request, request.headers.get('cf-connecting-ip') ?? 'local', 'create-player');
    const id = crypto.randomUUID();
    const row = await database().prepare("INSERT INTO members(id, username, display_name, phone, password_hash, player_id) SELECT ?, ?, 'PLAYER', NULL, '', ? FROM system_settings WHERE id = 1 AND registration_enabled = 1 RETURNING id").bind(id, 'player_' + id, 'RW-' + id.replaceAll('-', '').toUpperCase()).first();
    if (!row) throw new ApiError(403, 'REGISTRATION OFFLINE');
    return json({ ok: true, status: 'PLAYER CREATED' }, 201, { 'Set-Cookie': await createSession(request, id) });
  } catch (error) { return apiError(error); }
}
