import { env } from "cloudflare:workers";
import { Buffer } from "node:buffer";
import { scrypt, timingSafeEqual } from "node:crypto";
import type { Member } from "./member-types";

const COOKIE = "reworld_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const memberColumns = "m.id, m.username, m.display_name AS displayName, m.phone, m.email, m.access_role AS accessRole, m.created_at AS createdAt";
export function database() { return env.DB as D1Database; }
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
export function apiError(error: unknown) {
  if (error instanceof ApiError) return json({ error: error.message }, error.status, error.status === 429 ? { "Retry-After": "900" } : {});
  console.error("Member operation failed");
  return json({ error: "服務暫時無法使用，請稍後再試。" }, 503);
}
export function verifyOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new ApiError(403, "請從本站重新操作。");
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  verifyOrigin(request);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "請使用正確的資料格式。");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "缺少資料。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new ApiError(413, "輸入資料過長。"); }
    chunks.push(value);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return payload;
  } catch { throw new ApiError(400, "資料格式有誤。"); }
}
export function account(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().normalize("NFKC").toLowerCase() : "";
  if (!/^[\p{L}\p{N}_]{2,24}$/u.test(normalized)) throw new ApiError(400, "帳號請使用 2–24 個中文字、英文字母、數字或底線。");
  return normalized;
}
export function password(value: unknown) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new ApiError(400, "密碼請使用 8–128 個字元。");
  return value;
}
export function profile(payload: Record<string, unknown>) {
  const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const phone = typeof payload.phone === "string" ? payload.phone.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!displayName || displayName.length > 40) throw new ApiError(400, "暱稱請填寫 1–40 個字元。");
  if (phone && !/^[+0-9 ()-]{6,24}$/.test(phone)) throw new ApiError(400, "請確認聯絡電話格式。");
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new ApiError(400, "請確認 Email 格式。");
  return { displayName, phone, email };
}
export async function digest(value: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))).toString("hex");
}
function derive(value: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(value, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(value: string) {
  const salt = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(value, salt)).toString("hex")}`;
}
export async function verifyPassword(value: string, encoded: string | undefined) {
  const [version, salt, hash] = (encoded ?? "scrypt-v1$00000000000000000000000000000000$" + "0".repeat(64)).split("$");
  if (version !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(hash)) return false;
  const match = timingSafeEqual(await derive(value, salt), Buffer.from(hash, "hex"));
  return Boolean(encoded) && match;
}
export function sessionToken(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map(item => item.trim()).find(item => item.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function cookie(request: Request, token: string, maxAge = SESSION_SECONDS) {
  const url = new URL(request.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${url.protocol === "https:" || !local ? "; Secure" : ""}`;
}
export async function currentMember(request: Request): Promise<Member | null> {
  const token = sessionToken(request);
  if (!token) return null;
  return database().prepare(`SELECT ${memberColumns} FROM member_sessions s JOIN members m ON m.id = s.member_id WHERE s.token_hash = ? AND s.expires_at > ?`).bind(await digest(token), Date.now()).first<Member>();
}
export async function requireMember(request: Request) {
  const member = await currentMember(request);
  if (!member) throw new ApiError(401, "請先登入會員。");
  return member;
}
export async function createSession(request: Request, memberId: string) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
  const db = database();
  const old = sessionToken(request);
  const statements = [db.prepare("DELETE FROM member_sessions WHERE expires_at <= ?").bind(Date.now())];
  if (old) statements.push(db.prepare("DELETE FROM member_sessions WHERE token_hash = ?").bind(await digest(old)));
  statements.push(db.prepare("INSERT INTO member_sessions (token_hash, member_id, expires_at) VALUES (?, ?, ?)").bind(await digest(token), memberId, Date.now() + SESSION_SECONDS * 1000));
  await db.batch(statements);
  return cookie(request, token);
}
// Atomic database counters also apply across multiple Worker instances.
export async function rateLimit(request: Request, username: string, action: string) {
  const window = Math.floor(Date.now() / 900000);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const keys = [await digest(`${action}:ip:${ip}:${window}`), await digest(`${action}:account:${username}:${window}`)];
  const db = database();
  const results = await db.batch<{ attempts: number }>(keys.map(key => db.prepare("INSERT INTO auth_limits (key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts").bind(key, (window + 1) * 900000)));
  await db.prepare("DELETE FROM auth_limits WHERE expires_at < ?").bind(Date.now()).run();
  if (Number(results[0].results[0].attempts) > 40 || Number(results[1].results[0].attempts) > 10) throw new ApiError(429, "嘗試次數過多，請 15 分鐘後再試。");
}
