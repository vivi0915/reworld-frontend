"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { CircleUserRound, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Member } from '@/lib/member-types';

type Claim = { id: string; reward_key: string; status: string; requires_phone_verification: number; claimable: number };
type Result = { error?: string; code?: string; status?: string; challengeId?: string; expiresIn?: number; resendAfter?: number; restoreToken?: string };
export function MemberPanel({ member, loading, error, onRefresh, registrationEnabled }: { member: Member | null; loading: boolean; error: string; onRefresh: () => Promise<void>; registrationEnabled: boolean }) {
  const [mode, setMode] = useState<'none' | 'attach' | 'recover' | 'legacy'>('none');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState('');
  const [restoreToken, setRestoreToken] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [expires, setExpires] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [history, setHistory] = useState<Array<{ id: string; type: string; value: string; created_at: string }>>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  useEffect(() => {
    const timer = setInterval(() => { setCooldown(value => Math.max(0, value - 1)); setRemaining(Math.max(0, Math.ceil((expires - Date.now()) / 1000))); }, 1000);
    return () => clearInterval(timer);
  }, [expires]);
  useEffect(() => {
    if (!member) return;
    const controller = new AbortController();
    fetch('/api/player/history', { signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('無法讀取玩家紀錄。'); return r.json() as Promise<{ history: typeof history; claims: Claim[] }>; }).then(data => { setHistory(data.history); setClaims(data.claims); }).catch(e => { if (!controller.signal.aborted) setMessage(e.message); });
    return () => controller.abort();
  }, [member]);
  function select(next: typeof mode) { setMode(next); setChallenge(''); setRestoreToken(''); setMessage(''); }
  async function request(path: string, data: Record<string, unknown> = {}) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await r.json() as Result;
    if (!r.ok) {
      if (result.restoreToken) { setRestoreToken(result.restoreToken); setChallenge(result.challengeId!); }
      throw new Error(result.error ?? '操作失敗。');
    }
    return result;
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  async function create() {
    await run(async () => { await request('/api/player/create'); await onRefresh(); select('none'); setMessage('PLAYER CREATED · 你可以直接開始使用，手機驗證可稍後進行。'); });
  }
  async function send() {
    if (cooldown) return;
    const data = await request('/api/member/otp/send', { phone, purpose: mode });
    setChallenge(data.challengeId!); setRestoreToken(''); setExpires(Date.now() + data.expiresIn! * 1000); setRemaining(data.expiresIn!); setCooldown(data.resendAfter!); setMessage('驗證碼已發送。');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      if (mode !== 'legacy' && !challenge) { await send(); return; }
      const data = await request(mode === 'legacy' ? '/api/member/login' : '/api/member/otp/verify', mode === 'legacy' ? form : { phone, challengeId: challenge, code: form.code });
      await onRefresh(); select('none'); setMessage(data.status || 'LOGIN SUCCESS');
    });
  }
  async function restore() {
    await run(async () => { await request('/api/member/otp/restore', { challengeId: challenge, restoreToken }); await onRefresh(); select('none'); setMessage('PLAYER RESTORED · 已恢復原本的 Player 與紀錄。'); });
  }
  async function claim(item: Claim) {
    if (item.requires_phone_verification && !member?.phoneVerifiedAt) { select('attach'); setMessage('VERIFY PLAYER TO CLAIM · 驗證可保護 Player ID、跨裝置保存進度並領取此獎勵。'); return; }
    await run(async () => { await request('/api/rewards/claim', { claimId: item.id }); await onRefresh(); setMessage('CLAIM SUCCESS'); });
  }
  async function logout() {
    await run(async () => { await request('/api/member/logout'); setHistory([]); setClaims([]); await onRefresh(); select('none'); setMessage('GUEST MODE'); });
  }
  return <div className="screen member-screen">
    <div className="eyebrow">PLAYER ID · 05</div>
    <h1>{member ? (member.phoneVerifiedAt ? 'VERIFIED PLAYER' : 'PLAYER ID') : 'CREATE PLAYER ID'}</h1>
    <p className="screen-copy">{member ? '保存你的角色、冒險與 Reward。' : 'GUEST 也能 ACCESS、看酒單與抽卡。免費建立 Player ID，不需要手機號碼。'}</p>
    {loading ? <p role="status">正在讀取玩家資料…</p> : error ? <div><p role="alert">{error}</p><Button onClick={() => void onRefresh().catch(() => {})}>重試</Button><Button disabled={busy} onClick={logout}>回到 GUEST</Button></div> : <>
      {member ? <>
        <div className="member-card"><CircleUserRound size={32} /><div><strong>{member.playerId}</strong><span>{member.phoneVerifiedAt ? 'VERIFIED PLAYER' : 'PLAYER'}</span><small>{member.phone || '尚未綁定手機'}</small><small>{member.status.toUpperCase()}</small></div></div>
        {!member.phoneVerifiedAt && mode === 'none' && <section className="member-form"><h2>VERIFY PLAYER</h2><p className="screen-copy">Secure your Player ID<br />Save progress across devices<br />Claim member rewards</p><p className="screen-copy">未驗證時，進度保存在此瀏覽器登入狀態中；登出或清除 Cookie 後可能無法找回。</p><Button disabled={busy} onClick={() => select('attach')}>VERIFY MOBILE</Button><Button variant="ghost" disabled={busy} onClick={() => setMessage('NOT NOW · 你可以繼續使用一般 PLAYER 功能。')}>NOT NOW</Button></section>}
        <h2>CLASS HISTORY</h2>
        {history.length ? history.map(item => <article className="directory-entry" key={item.id}><strong>{item.value}</strong><small>{item.created_at}</small></article>) : <p className="screen-copy">尚無角色選擇紀錄。</p>}
        <h2>REWARD / CLAIM</h2>
        {claims.length ? claims.map(item => <article className="directory-entry" key={item.id}><strong>{item.reward_key}</strong><span>{item.status.toUpperCase()}</span>{item.claimable === 1 && ['available', 'unlocked'].includes(item.status) && <Button disabled={busy} onClick={() => void claim(item)}>{item.requires_phone_verification && !member.phoneVerifiedAt ? 'VERIFY PLAYER TO CLAIM' : 'CLAIM REWARD'}</Button>}</article>) : <p className="screen-copy">尚無會員限定 Reward。抽卡獎勵可至冒險紀錄查看。</p>}
      </> : <>
        {!registrationEnabled && <p className="system-notice">REGISTRATION OFFLINE · 已有 PLAYER 仍可登入。</p>}
        <Button className="primary-action" disabled={busy || !registrationEnabled} onClick={create}>CREATE PLAYER ID</Button>
        <p className="screen-copy">手機驗證可稍後進行；先在目前裝置保存冒險。</p>
        <Button variant="outline" disabled={busy} onClick={() => select('recover')}>RESTORE PLAYER · 手機登入／找回</Button>
        <Button variant="ghost" disabled={busy} onClick={() => select('legacy')}>原有帳號登入</Button>
      </>}
      {mode !== 'none' && <section className="member-form"><h2>{mode === 'attach' ? 'VERIFY MOBILE' : mode === 'recover' ? 'RESTORE PLAYER' : 'LOGIN'}</h2>
        {restoreToken ? <><p>PLAYER ALREADY EXISTS</p><p className="screen-copy">此手機已綁定另一個 Player ID。繼續將登入原本帳號；目前 Player 的紀錄不會合併。</p><Button disabled={busy || !remaining} onClick={restore}>CONTINUE WITH EXISTING PLAYER</Button>{!remaining && <p>恢復憑證已過期，請重新發送驗證碼。</p>}</> : <form className="member-form" onSubmit={submit}>
          {mode === 'legacy' ? <><label>原有帳號<Input name="username" required autoComplete="username" disabled={busy} /></label><label>密碼<Input name="password" type="password" required autoComplete="current-password" disabled={busy} /></label></> : <>
            <label>PHONE NUMBER<Input type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={busy || Boolean(challenge)} placeholder="09xxxxxxxx" autoComplete="tel" required /></label>
            {challenge && <><label>SMS OTP<Input key={challenge} name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" placeholder="六位數驗證碼" required disabled={busy} /></label><small>{remaining > 0 ? `驗證碼有效時間：${remaining} 秒` : '驗證碼已過期，請重新發送。'}</small><Button type="button" variant="outline" disabled={busy || cooldown > 0} onClick={() => void run(send)}>{cooldown ? `${cooldown} 秒後可重送` : 'RESEND OTP'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setChallenge('')}>修改手機號碼</Button></>}
          </>}
          <Button type="submit" className="primary-action" disabled={busy || (mode !== 'legacy' && Boolean(challenge) && !remaining)}>{busy ? '處理中…' : mode === 'legacy' ? 'LOGIN' : challenge ? 'VERIFY IDENTITY' : 'SEND OTP'}</Button>
        </form>}
        <Button variant="ghost" disabled={busy} onClick={() => select('none')}>{member ? 'NOT NOW' : 'BACK'}</Button>
      </section>}
      {member && <><Button className="logout-action" onClick={logout} disabled={busy}><LogOut size={16} />登出</Button>{member.accessRole === 'admin' && <a className="primary-action" href="/admin">OPERATIONS CONSOLE</a>}</>}
    </>}
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}
