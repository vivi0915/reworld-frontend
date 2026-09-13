"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { CircleUserRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Member } from '@/lib/member-types';

export function MemberPanel({ member, loading, error, onRefresh, registrationEnabled }: { member: Member | null; loading: boolean; error: string; onRefresh: () => Promise<void>; registrationEnabled: boolean }) {
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [expires, setExpires] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [history, setHistory] = useState<Array<{ id: string; type: string; value: string; created_at: string }>>([]);
  const [claims, setClaims] = useState<Array<{ id: string; reward_key: string; status: string }>>([]);
  useEffect(() => {
    const timer = setInterval(() => { setCooldown(value => Math.max(0, value - 1)); setRemaining(Math.max(0, Math.ceil((expires - Date.now()) / 1000))); }, 1000);
    return () => clearInterval(timer);
  }, [expires]);
  useEffect(() => {
    if (!member) return;
    const controller = new AbortController();
    fetch('/api/player/history', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('無法讀取玩家紀錄。'); return r.json() as Promise<{ history: Array<{ id: string; type: string; value: string; created_at: string }>; claims: Array<{ id: string; reward_key: string; status: string }> }>; }).then(data => { setHistory(data.history); setClaims(data.claims); }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, [member]);
  async function request(path: string, data: Record<string, unknown> = {}) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await r.json() as { error?: string; challengeId: string; expiresIn: number; resendAfter: number }; if (!r.ok) throw new Error(result.error ?? '操作失敗。'); return result;
  }
  async function send() {
    if (busy || cooldown) return;
    setBusy(true); setMessage('');
    try { const data = await request('/api/member/otp/send', { phone }); setChallenge(data.challengeId); setExpires(Date.now() + data.expiresIn * 1000); setRemaining(data.expiresIn); setCooldown(data.resendAfter); setMessage('驗證碼已發送。'); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (!legacy && !challenge) { await send(); return; }
    setBusy(true); setMessage('');
    try {
      await request(legacy ? '/api/member/login' : '/api/member/otp/verify', legacy ? form : { phone, challengeId: challenge, code: form.code });
      await onRefresh(); setChallenge(''); setMessage(legacy ? 'LOGIN SUCCESS' : 'IDENTITY VERIFIED');
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await request('/api/member/logout'); setHistory([]); setClaims([]); await onRefresh(); setMessage('GUEST MODE'); }
    catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="screen member-screen">
    <div className="eyebrow">PLAYER ID · 05</div>
    <h1>{member ? 'PLAYER ID' : 'CREATE PLAYER ID'}</h1>
    <p className="screen-copy">{member ? '保存你的角色、冒險與 Reward。' : 'GUEST 也能 ACCESS、看酒單與抽卡。手機驗證後，保存未來的冒險紀錄。'}</p>
    {loading ? <p role="status">正在讀取玩家資料…</p> : error ? <div><p role="alert">{error}</p><Button onClick={() => void onRefresh().catch(() => {})}>重試</Button><Button disabled={busy} onClick={logout}>回到 GUEST</Button></div> : member ? <>
      <div className="member-card"><CircleUserRound size={32} /><div><strong>{member.playerId}</strong><span>{member.phoneVerified ? 'IDENTITY VERIFIED' : 'LEGACY PLAYER'}</span><small>{member.phone || member.username}</small><small>{member.status.toUpperCase()}</small></div></div>
      <h2>CLASS HISTORY</h2>
      {history.length ? history.map(item => <article className="directory-entry" key={item.id}><strong>{item.value}</strong><small>{item.created_at}</small></article>) : <p className="screen-copy">尚無角色選擇紀錄。</p>}
      <h2>REWARD / CLAIM</h2>
      {claims.length ? claims.map(item => <article className="directory-entry" key={item.id}><strong>{item.reward_key}</strong><span>{item.status.toUpperCase()}</span></article>) : <p className="screen-copy">尚無會員限定 Reward。抽卡獎勵可至冒險紀錄查看。</p>}
      <Button className="logout-action" onClick={logout} disabled={busy}><LogOut size={16} />登出</Button>
      {member.accessRole === 'admin' && <a className="primary-action" href="/admin">OPERATIONS CONSOLE</a>}
    </> : <>
      {!registrationEnabled && <p className="system-notice">REGISTRATION OFFLINE · 已有 PLAYER 仍可登入。</p>}
      <form className="member-form" onSubmit={submit}>
        {legacy ? <><label>原有帳號<Input name="username" required autoComplete="username" disabled={busy} /></label><label>密碼<Input name="password" type="password" required autoComplete="current-password" disabled={busy} /></label></> : <>
          <label>PHONE NUMBER<Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={busy || Boolean(challenge)} placeholder="09xxxxxxxx" autoComplete="tel" required /></label>
          {challenge && <><label>SMS OTP<Input key={challenge} name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="六位數驗證碼" required disabled={busy} /></label><small>{remaining > 0 ? `驗證碼有效時間：${remaining} 秒` : '驗證碼已過期，請重新發送。'}</small><Button type="button" variant="outline" disabled={busy || cooldown > 0} onClick={send}>{cooldown ? `${cooldown} 秒後可重送` : 'RESEND OTP'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { setChallenge(''); setMessage(''); }}>修改手機號碼</Button></>}
        </>}
        <Button type="submit" className="primary-action" disabled={busy || (!legacy && Boolean(challenge) && !remaining)}>{busy ? '處理中…' : legacy ? 'LOGIN' : challenge ? 'VERIFY IDENTITY' : 'SEND OTP'}</Button>
      </form>
      <Button variant="ghost" disabled={busy} onClick={() => { setLegacy(!legacy); setMessage(''); }}>{legacy ? '使用手機驗證' : '原有帳號登入'}</Button>
    </>}
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}
