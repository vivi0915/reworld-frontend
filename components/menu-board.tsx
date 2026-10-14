"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Hourglass, LockKeyhole, MapPin, Martini, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MemberPanel } from '@/components/member-panel';
import { drinks, explorationLabel, rollMenuDice, type Exploration } from '@/lib/menu-catalog';
import type { Member } from '@/lib/member-types';

const positions = [[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[4,1],[3,1],[2,1]];
const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];
export function MenuBoard({ member, memberLoading, memberError, onRefresh, registrationEnabled }: {
  member: Member | null; memberLoading: boolean; memberError: string;
  onRefresh: () => Promise<void>; registrationEnabled: boolean;
}) {
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState(0);
  const [dice, setDice] = useState([1,1]);
  const [rolling, setRolling] = useState(false);
  const [message, setMessage] = useState('擲兩顆骰子選酒，也可以直接點選酒款。');
  const [progress, setProgress] = useState<Exploration | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lifetime = useRef<AbortController | null>(null);
  const version = useRef(0);
  const memberId = member?.id;
  const refresh = useCallback(async (signal: AbortSignal) => {
    if (!memberId) return;
    const revision = ++version.current;
    try {
      const response = await fetch('/api/menu/exploration', { signal, cache: 'no-store' });
      if (response.status === 401 || response.status === 403) {
        setProgress(null);
        await onRefresh();
        throw new Error('登入狀態已變更，請重新登入。');
      }
      const data = await response.json() as Exploration & { error?: string };
      if (!response.ok) throw new Error(data.error || '無法讀取探索進度。');
      if (data.memberId !== memberId) { setProgress(null); await onRefresh(); return; }
      if (!signal.aborted && revision === version.current) { setProgress(data); setError(''); }
    } catch (e) {
      if (!signal.aborted && revision === version.current) { setProgress(null); setError((e as Error).message); }
    }
  }, [memberId, onRefresh]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    const update = () => { if (!document.hidden) void refresh(controller.signal); };
    update();
    const poll = setInterval(update, 10000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      controller.abort(); clearInterval(poll);
      window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update);
      timers.current.forEach(clearTimeout);
    };
  }, [refresh]);
  const current = progress?.memberId === memberId ? progress : null;
  const state = (id: string) => current?.records.find(record => record.drinkId === id);
  const allDone = current?.completed === drinks.length;
  const item = drinks[selected];
  const record = state(item.id);
  async function choose() {
    if (busy || !member || !current || !lifetime.current) return;
    const signal = lifetime.current.signal;
    setBusy(true); setError(''); ++version.current;
    try {
      const response = await fetch('/api/menu/exploration', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drinkId: item.id, expectedMemberId: memberId }), signal });
      const data = await response.json() as Exploration & { error?: string };
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { setProgress(null); await onRefresh(); }
        throw new Error(data.error || '選擇未成功，請重試。');
      }
      if (data.memberId !== memberId) { setProgress(null); await onRefresh(); return; }
      if (!signal.aborted) { ++version.current; setProgress(data); setMessage(data.records.find(r => r.drinkId === item.id)?.status === 'completed' ? '這杯已探索，不會重複增加進度。' : '已送出，等待店員確認；目前尚未計入進度。'); }
    } catch (e) { if (!signal.aborted) setError((e as Error).message); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  function roll() {
    if (running.current) return;
    const pool = drinks.map((drink,index) => ({ drink,index })).filter(({drink}) => !(onlyNew && current && !allDone) || state(drink.id)?.status !== 'completed');
    const result = rollMenuDice(pool.length);
    const target = pool[result.index].index;
    running.current = true; setRolling(true); setMessage('骰子滾動中…');
    const finish = () => {
      setDice(result.dice); setPosition(target); setSelected(target);
      setMessage(`擲出 ${result.dice[0]}、${result.dice[1]} 點，選中「${drinks[target].name}」${state(drinks[target].id)?.status === 'completed' ? ' · 已探索' : ''}。`);
      setRolling(false); running.current = false; timers.current = [];
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    for (let step = 1; step <= 12; step++) timers.current.push(setTimeout(() => {
      setPosition((position + step) % drinks.length); setDice([step % 6 + 1, (step + 2) % 6 + 1]);
    }, step * 70));
    timers.current.push(setTimeout(finish, 1000));
  }
  return <div className="screen menu-screen">
    <div className="eyebrow">FLAVOR MAP · 04</div><h1>風味大富翁</h1>
    <p className="screen-copy">擲兩顆骰子探索菜單，決定今晚的靈感。</p>
    <section className="exploration-summary" aria-label="酒單探索進度" aria-live="polite">
      {memberLoading ? <p>正在確認登入狀態…</p> : !member ? <>
        <p>登入會員，記錄你的探索進度；集滿 12 杯，解鎖實體酒單。</p>
        <Button variant="outline" onClick={() => setLoginOpen(true)}>登入／註冊</Button>
      </> : <>
        <small>{member.playerId} · 我的探索</small>
        <strong>{current ? `${current.completed} / 12 DISCOVERED` : '正在同步探索進度…'}</strong>
        {current && <progress max={12} value={current.completed} aria-label={`已探索 ${current.completed} 杯，共 12 杯`} />}
        <small>由店員確認後計入進度</small>
        {allDone && <><strong className="world-completed">WORLD COMPLETED</strong><Button variant="outline" onClick={() => setVoucherOpen(true)}><Ticket size={18} />實體酒單兌換券</Button></>}
        <Button variant="ghost" onClick={() => setLoginOpen(true)}>會員／登出</Button>
      </>}
    </section>
    {error && <div role="alert"><p>{error}</p><Button variant="outline" onClick={() => lifetime.current && void refresh(lifetime.current.signal)}>重新讀取進度</Button></div>}
    <p className="demo-note">四種角色 × 各三杯 · 酒名與價格待確認</p>
    <div className="menu-board" aria-label="十二杯調酒">
      {drinks.map((drink,i) => {
        const status = state(drink.id)?.status;
        const label = explorationLabel(status);
        const Icon = status === 'completed' ? Check : status === 'pending' ? Hourglass : LockKeyhole;
        return <button key={drink.id} className={`menu-tile ${selected === i ? 'selected' : ''} ${position === i ? 'occupied' : ''} ${current ? 'exploration-' + (status || 'locked') : ''}`}
          style={{ gridRow: positions[i][0], gridColumn: positions[i][1], '--tile-color': drink.color } as React.CSSProperties}
          onClick={() => setSelected(i)} disabled={rolling || busy} aria-pressed={selected === i} aria-label={`${drink.name}${current ? '，' + label : ''}`}>
          <span className="tile-number">{drink.code} · {drink.number}</span><strong>{drink.name}</strong>
          {current && <span className="tile-state"><Icon size={13} aria-hidden="true" />{label}</span>}
          {position === i && <MapPin size={17} className="board-token" aria-hidden="true" />}
        </button>;
      })}
      <div className="board-center"><span>re:world</span><div className="menu-dice">{dice.map((value,i) => {
        const Dice = diceIcons[value-1]; return <Dice key={i} size={34} className={rolling ? 'dice-rolling' : ''} aria-label={`骰子 ${i+1}：${value} 點`} />;
      })}</div><small>兩顆骰子 · 公平選酒</small></div>
    </div>
    {current && !allDone && <label className="menu-filter"><input type="checkbox" checked={onlyNew} disabled={rolling} onChange={e => setOnlyNew(e.target.checked)} />只骰未完成酒款</label>}
    <Button className="primary-action" onClick={roll} disabled={rolling || busy}>{rolling ? '探索中…' : '擲兩顆骰子，探索下一杯'}</Button>
    <small className="dice-note">依骰子組合選酒，不以點數加總；每杯中選機率相同。</small>
    <p className="board-status" role="status">{message}</p>
    <article className="menu-detail" aria-live="polite">
      <div className="menu-detail-category"><Martini size={18} />{item.category}</div>
      <div className="menu-detail-heading"><h2>{item.name}</h2><strong>價格待確認</strong></div><p>{item.description}</p>
      {current && <p>{explorationLabel(record?.status)}{record?.confirmedAt && ` · 首次完成：${new Date(record.confirmedAt.replace(' ','T')+'Z').toLocaleDateString('zh-TW',{ timeZone: 'Asia/Taipei' })}`}</p>}
      {member && <><Button className="primary-action" disabled={!current || busy || rolling || record?.status === 'pending'} onClick={() => void choose()}>{busy ? '送出中…' : record?.status === 'pending' ? '已送出 · 等待店員確認' : '本次選擇這杯'}</Button><p className="screen-copy">{record?.status === 'completed' ? '這杯已探索，再次選擇不會重複計入。' : '送出後僅建立待確認紀錄，請由店員核對。'}</p></>}
      <small>探索菜單不會下單或產生費用。</small>
    </article>
    <Dialog open={loginOpen} onOpenChange={setLoginOpen}><DialogContent className="menu-dialog"><DialogTitle>會員登入／註冊</DialogTitle><DialogDescription>在這裡完成登入後，酒單會立即同步你的探索進度。</DialogDescription>
      <MemberPanel key={member?.id || 'guest'} member={member} loading={memberLoading} error={memberError} registrationEnabled={registrationEnabled} onRefresh={async () => { await onRefresh(); setLoginOpen(false); }} />
    </DialogContent></Dialog>
    <Dialog open={voucherOpen && Boolean(allDone)} onOpenChange={setVoucherOpen}><DialogContent className="menu-dialog"><DialogTitle>實體酒單兌換券</DialogTitle><DialogDescription>已集滿十二杯，請向店員出示此頁；由店員核對後兌換一次實體酒單。</DialogDescription>
      {current?.voucher ? <div className="menu-voucher"><Ticket size={32} /><strong>{current.voucher.redeemedAt ? '已兌換' : '可兌換 · WORLD COMPLETED'}</strong><span>{member?.playerId}</span><code>{current.voucher.code}</code><small>店員以後台即時紀錄為準，截圖不代表有效兌換。</small></div> : <p>兌換券正在同步，請稍後重新讀取進度。</p>}
    </DialogContent></Dialog>
  </div>;
}
