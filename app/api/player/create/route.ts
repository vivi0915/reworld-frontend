import { json } from '@/lib/member-auth';
export async function POST() { return json({ error: '請使用手機驗證註冊會員。' }, 410); }
