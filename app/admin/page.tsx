import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/operations';
import { AdminConsole } from '@/components/admin-console';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  try { await requireAdmin(new Request('https://reworld.internal/admin', { headers: await headers() })); }
  catch { return <main className="admin-shell"><h1>ACCESS DENIED</h1><p>請使用有效的管理員帳號登入。</p><Link href="/">返回 REWORLD</Link></main>; }
  return <AdminConsole />;
}
