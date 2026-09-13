import { apiError, json, readBody } from '@/lib/member-auth';
export async function POST(request: Request) {
  try { await readBody(request); return json({ error: '請使用手機驗證建立 PLAYER ID。' }, 410); }
  catch (error) { return apiError(error); }
}
