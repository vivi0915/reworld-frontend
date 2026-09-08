import { account, apiError, ApiError, createSession, database, hashPassword, json, password, profile, rateLimit, readBody } from "@/lib/member-auth";

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const username = account(body.username);
    const secret = password(body.password);
    const details = profile(body);
    await rateLimit(request, username, "register");
    const id = crypto.randomUUID();
    const hash = await hashPassword(secret);
    const inserted = await database().prepare("INSERT INTO members (id, username, display_name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO NOTHING RETURNING id").bind(id, username, details.displayName, details.phone, details.email, hash).first();
    if (!inserted) throw new ApiError(409, "此帳號已被使用，請更換帳號或登入。");
    return json({ ok: true }, 201, { "Set-Cookie": await createSession(request, id) });
  } catch (error) { return apiError(error); }
}
