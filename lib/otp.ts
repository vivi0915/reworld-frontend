import { env } from 'cloudflare:workers';
import { ApiError, database, digest } from './member-auth';

// Provider-neutral server binding. No console sender, fixed OTP or client bypass.
type SmsEnvironment = { SMS?: Fetcher; OTP_SECRET?: string };
export function smsConfiguration() {
  const config = env as unknown as SmsEnvironment;
  if (!config.SMS || !config.OTP_SECRET || config.OTP_SECRET.length < 32) throw new ApiError(503, '手機驗證暫時無法使用，請繼續以 GUEST 體驗。');
  return { sms: config.SMS, secret: config.OTP_SECRET };
}
export function normalizePhone(value: unknown) {
  const phone = typeof value === 'string' ? value.trim().replace(/[ -]/g, '') : '';
  if (/^09\d{8}$/.test(phone)) return '+886' + phone.slice(1);
  if (/^\+8869\d{8}$/.test(phone)) return phone;
  throw new ApiError(400, '請輸入有效的台灣手機號碼。');
}
export async function otpHash(id: string, phone: string, code: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${id}:${phone}:${code}`))), n => n.toString(16).padStart(2, '0')).join('');
}
export async function otpSendLimit(request: Request, phone: string) {
  const now = Date.now();
  const window = Math.floor(now / 3600000);
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const keys = await Promise.all([digest(`otp:cooldown:${phone}`), digest(`otp:phone:${phone}:${window}`), digest(`otp:ip:${ip}:${window}`)]);
  const db = database();
  const results = await db.batch<{ attempts: number }>(keys.map((key, i) => db.prepare('INSERT INTO otp_limits(key, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key, i === 0 ? now + 60000 : (window + 1) * 3600000, now, now)));
  if (results[0].results[0].attempts > 1) throw new ApiError(429, '請等待 60 秒再重新發送。');
  if (results[1].results[0].attempts > 5 || results[2].results[0].attempts > 20) throw new ApiError(429, '發送次數過多，請稍後再試。');
  await db.batch([db.prepare('DELETE FROM otp_limits WHERE expires_at < ?').bind(now), db.prepare('DELETE FROM otp_challenges WHERE expires_at < ?').bind(now - 86400000)]);
}
