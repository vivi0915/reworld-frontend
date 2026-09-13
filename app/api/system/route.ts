import { apiError, json } from '@/lib/member-auth';
import { settings } from '@/lib/operations';
export async function GET() {
  try { return json({ settings: await settings() }); } catch (error) { return apiError(error); }
}
