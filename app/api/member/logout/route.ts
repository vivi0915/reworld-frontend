import { apiError, cookie, database, digest, json, sessionToken, verifyOrigin } from "@/lib/member-auth";
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const token = sessionToken(request);
    if (token) await database().prepare("DELETE FROM member_sessions WHERE token_hash = ?").bind(await digest(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(request, "", 0) });
  } catch (error) { return apiError(error); }
}
