import { account, apiError, ApiError, createSession, database, json, password, rateLimit, readBody, verifyPassword } from "@/lib/member-auth";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const username = account(body.username);
    const secret = password(body.password);
    await rateLimit(request, username, "login");
    const member = await database().prepare("SELECT id, password_hash FROM members WHERE username = ?").bind(username).first<{ id: string; password_hash: string }>();
    if (!await verifyPassword(secret, member?.password_hash) || !member) throw new ApiError(401, "帳號或密碼不正確。");
    return json({ ok: true }, 200, { "Set-Cookie": await createSession(request, member.id) });
  } catch (error) { return apiError(error); }
}
