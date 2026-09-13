'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PublicSettings } from '@/lib/operations';
import type { Member } from '@/lib/member-types';

async function api<T = { ok: boolean }>(path: string, body?: Record<string, unknown>) {
  const response = await fetch(path, { cache: 'no-store', ...(body ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(data.error || '操作失敗。'); return data;
}
type Detail = { member: Member; history: Array<{ id: string; value: string; created_at: string }>; draws: Array<{ id: number; role: string; reward: string; used: number; created_at: string }>; claims: Array<{ id: string; reward_key: string; status: string }> };
type Log = { id: string; admin_id?: string; action?: string; created_at?: string; user_id?: string; session_id?: string; accessed_at?: string; result?: string };
const toggles = [ ['store_online', 'STORE STATUS'], ['door_access_enabled', 'DOOR ACCESS'], ['card_draw_enabled', 'CARD DRAW'], ['registration_enabled', 'REGISTRATION'] ] as const;
export function AdminConsole() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('settings');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const refresh = useCallback(async () => {
    const [config, dashboard] = await Promise.all([api<{ settings: PublicSettings; pinConfigured: boolean }>('/api/admin/settings'), api<{ stats: Record<string, number> }>('/api/admin/dashboard')]);
    setSettings(config.settings); setPinConfigured(config.pinConfigured); setStats(dashboard.stats);
  }, []);
  // Initial server synchronization; state changes follow awaited network responses.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh().catch(e => setMessage(e.message)); }, [refresh]);
  async function change(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await api('/api/admin/settings', body); await refresh(); setMessage('MISSION COMPLETE · 設定已生效'); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function list(next = 0) {
    setBusy(true); setMessage('');
    try { const data = await api<{ members: Member[]; hasMore: boolean }>(`/api/admin/members?page=${next}&q=${encodeURIComponent(query)}`); setMembers(data.members); setMore(data.hasMore); setPage(next); setDetail(null); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function openMember(id: string) {
    setBusy(true); setDetail(null); setMessage('');
    try { setDetail(await api<Detail>('/api/admin/member?id=' + encodeURIComponent(id))); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function suspend() {
    if (!detail || busy) return;
    setBusy(true);
    try { await api('/api/admin/member', { id: detail.member.id, status: detail.member.status === 'active' ? 'suspended' : 'active' }); setDetail(await api('/api/admin/member?id=' + encodeURIComponent(detail.member.id))); setMessage('Account status updated'); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function loadLogs(type: string, next = 0) {
    setBusy(true); setMessage(''); setLogs([]);
    try { const data = await api<{ logs: Log[]; hasMore: boolean }>(`/api/admin/logs?type=${type}&page=${next}`); setLogs(data.logs); setMore(data.hasMore); setPage(next); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  function select(value: string) { setTab(value); setPage(0); setMore(false); setMessage(''); if (value === 'members') void list(); else if (value !== 'settings') void loadLogs(value); }
  function savePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const pin = new FormData(form).get('pin'); form.reset(); void change({ door_pin: pin });
  }
  return <main className="admin-shell">
    <header className="admin-header"><div><div className="eyebrow">REWORLD · CONTROL ROOM</div><h1>OPERATIONS</h1></div><Link href="/">BACK TO APP</Link></header>
    <section className="admin-stats">{[['membersToday', '今日新會員'], ['membersTotal', '會員總數'], ['accessToday', '今日 Door Access'], ['drawsToday', '今日抽卡']].map(([key, label]) => <article key={key}><span>{label}</span><strong>{stats[key] ?? '—'}</strong></article>)}</section>
    <p className="screen-copy">今日統計以台灣時間計算。</p>
    <Tabs value={tab} onValueChange={select}><TabsList aria-label="營運管理">{[['settings', 'SYSTEM'], ['members', 'MEMBERS'], ['access', 'ACCESS LOG'], ['audit', 'AUDIT LOG']].map(([value, label]) => <TabsTrigger key={value} value={value} disabled={busy}>{label}</TabsTrigger>)}</TabsList></Tabs>
    {message && <p className="system-notice" role="status">{message}</p>}
    {!settings && <Button onClick={() => void refresh().catch(e => setMessage(e.message))}>讀取營運設定</Button>}
    {tab === 'settings' && settings && <>
      <section className="admin-toggles">{toggles.map(([key, label]) => <article key={key}><label htmlFor={key}>{label}<strong>{key === 'store_online' ? (settings[key] ? 'ONLINE' : 'OFFLINE') : (settings[key] ? 'ON' : 'OFF')}</strong></label><Switch id={key} checked={Boolean(settings[key])} disabled={busy} onCheckedChange={checked => void change({ [key]: checked })} /></article>)}</section>
      <section className="admin-settings"><form className="member-form" onSubmit={e => { e.preventDefault(); void change({ maintenance_message: new FormData(e.currentTarget).get('message') }); }}><h2>MAINTENANCE MESSAGE</h2><Textarea key={settings.maintenance_message} name="message" defaultValue={settings.maintenance_message} maxLength={500} rows={4} aria-label="Maintenance Message" /><Button disabled={busy}>SAVE MESSAGE</Button></form>
      <div><h2>DOOR ACCESS</h2><p className="screen-copy">Door PIN：{pinConfigured ? '•••••• · 已設定' : '尚未設定'}</p><form className="member-form" onSubmit={savePin}><label>新的 Door PIN<Input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" minLength={4} maxLength={12} autoComplete="new-password" placeholder="••••••" required /></label><Button disabled={busy}>UPDATE PIN</Button></form><Button variant="outline" disabled={busy || !pinConfigured} onClick={() => void change({ door_pin: null })}>CLEAR PIN</Button><form className="member-form" onSubmit={e => { e.preventDefault(); void change({ door_pin_display_seconds: Number(new FormData(e.currentTarget).get('seconds')) }); }}><label>DISPLAY DURATION · SEC<Input key={settings.door_pin_display_seconds} name="seconds" type="number" min={5} max={60} defaultValue={settings.door_pin_display_seconds} required /></label><Button disabled={busy}>SAVE DURATION</Button></form></div></section>
    </>}
    {tab === 'members' && <section><form className="admin-search" onSubmit={e => { e.preventDefault(); void list(); }}><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="手機號碼 / Player ID" aria-label="搜尋會員" maxLength={64} /><Button disabled={busy}>SEARCH</Button></form>{members.map(member => <button className="admin-member" key={member.id} disabled={busy} onClick={() => void openMember(member.id)}><strong>{member.playerId}</strong><span>{member.phone || '未驗證手機'}</span><small>{member.status} · {member.createdAt}</small></button>)}{!busy && !members.length && <p>沒有符合的會員。</p>}
      {detail && <article className="admin-detail"><h2>{detail.member.playerId}</h2><p>{detail.member.phone || '未填手機'} · {detail.member.phoneVerified ? 'VERIFIED' : 'UNVERIFIED'}</p><p>註冊：{detail.member.createdAt}</p><p>最後登入：{detail.member.lastLoginAt || '—'}</p><p>ACCOUNT STATUS：{detail.member.status}</p><Button disabled={busy || detail.member.accessRole === 'admin'} onClick={suspend}>{detail.member.status === 'active' ? 'SUSPEND' : 'UNSUSPEND'}</Button><h3>CLASS HISTORY · 最近 100 筆</h3>{detail.history.length ? detail.history.map(row => <p key={row.id}>{row.value} · {row.created_at}</p>) : <p>尚無紀錄</p>}<h3>DRAW HISTORY · 最近 100 筆</h3>{detail.draws.length ? detail.draws.map(row => <p key={row.id}>{row.role} · {row.reward} · {row.used ? 'CLAIMED' : 'UNCLAIMED'} · {row.created_at}</p>) : <p>尚無紀錄</p>}<h3>REWARD / CLAIM</h3>{detail.claims.length ? detail.claims.map(row => <p key={row.id}>{row.reward_key} · {row.status}</p>) : <p>尚無紀錄</p>}</article>}
    </section>}
    {(tab === 'access' || tab === 'audit') && <section className="admin-logs">{logs.map(log => <article key={log.id}><time>{log.created_at || log.accessed_at} UTC</time><strong>{log.action || log.result}</strong><small>{log.admin_id ? `Admin ${log.admin_id}` : log.user_id ? `Player ${log.user_id}` : `Guest ${log.session_id?.slice(0, 12)}`}</small></article>)}{!busy && !logs.length && <p>尚無紀錄</p>}<Button disabled={busy} onClick={() => void loadLogs(tab, page)}>REFRESH</Button></section>}
    {tab !== 'settings' && <div className="directory-pagination"><Button disabled={busy || page === 0} onClick={() => tab === 'members' ? void list(page - 1) : void loadLogs(tab, page - 1)}>上一頁</Button><span>{page + 1}</span><Button disabled={busy || !more} onClick={() => tab === 'members' ? void list(page + 1) : void loadLogs(tab, page + 1)}>下一頁</Button></div>}
  </main>;
}
