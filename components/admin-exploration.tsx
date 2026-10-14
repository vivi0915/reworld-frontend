'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Hourglass, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { drinks, explorationLabel, type Exploration, type ExplorationRecord } from '@/lib/menu-catalog';
type Detail = Exploration & { events: Array<{ id: string; drinkId: string; action: string; reason: string; createdAt: string; actor: string }> };
export function AdminExploration({ memberId, playerId }: { memberId: string; playerId: string }) {
  const [data,setData] = useState<Detail | null>(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const [action,setAction] = useState<{ type: 'confirm' | 'revoke' | 'redeem'; record?: ExplorationRecord } | null>(null);
  const [reason,setReason] = useState('');
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch('/api/admin/exploration?memberId=' + encodeURIComponent(memberId), { signal, cache: 'no-store' });
    const result = await response.json() as Detail & { error?: string };
    if (!response.ok) throw new Error(result.error || '讀取進度失敗。');
    if (!signal.aborted) setData(result);
  }, [memberId]);
  useEffect(() => {
    const current = new AbortController(); controller.current = current;
    // Initial D1 synchronization: state is updated only after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(current.signal).catch(e => { if (!current.signal.aborted) setMessage(e.message); });
    return () => current.abort();
  }, [refresh]);
  async function apply() {
    if (!action || busy || !controller.current) return;
    const signal = controller.current.signal; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/exploration', { method: 'PATCH', signal, headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ memberId, action: action.type, drinkId: action.record?.drinkId, revision: action.record?.revision, reason, code: data?.voucher?.code }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || '更新失敗。');
      setAction(null); setReason('');
      await refresh(signal); setMessage('已更新，會員酒單會自動同步。');
    } catch (e) {
      if (!signal.aborted) { setMessage((e as Error).message); setAction(null); await refresh(signal).catch(() => setData(null)); }
    } finally { if (!signal.aborted) setBusy(false); }
  }
  return <section aria-label="會員調酒探索管理">
    <h3>調酒探索 · {data ? data.completed + ' / 12 DISCOVERED' : '讀取中'}</h3>
    <p>請先核對會員與酒款，僅確認實際完成的項目。待確認不計入進度。</p>
    <Button variant="outline" disabled={busy} onClick={() => controller.current && void refresh(controller.current.signal).catch(e => setMessage(e.message))}>重新讀取探索紀錄</Button>
    {message && <p role="status">{message}</p>}
    {data && <><div className="admin-exploration-grid">{drinks.map(drink => {
      const record = data.records.find(r => r.drinkId === drink.id);
      const Icon = record?.status === 'completed' ? Check : record?.status === 'pending' ? Hourglass : LockKeyhole;
      return <article className="admin-exploration-card" key={drink.id} style={{ '--tile-color':drink.color } as React.CSSProperties}>
        <strong>{drink.name}</strong><span><Icon size={16} aria-hidden="true" />{explorationLabel(record?.status)}</span>
        {record && <small>{record.status === 'completed' ? '確認：' + record.confirmedAt + ' UTC' : '選擇：' + record.requestedAt + ' UTC'}</small>}
        {record?.status === 'pending' && <Button disabled={busy} onClick={() => setAction({ type:'confirm',record })}>確認完成</Button>}
        {record?.status === 'completed' && <Button variant="outline" disabled={busy} onClick={() => { setReason(''); setAction({ type:'revoke',record }); }}>撤銷完成</Button>}
      </article>;
    })}</div>
    {data.voucher && <section><h3>實體酒單兌換券</h3><p>{data.voucher.redeemedAt ? '已兌換：' + data.voucher.redeemedAt + ' UTC' : data.voucher.eligible ? '可兌換' : '尚未集滿，暫停兌換'}</p><code>{data.voucher.code}</code>{data.voucher.eligible && !data.voucher.redeemedAt && <Button disabled={busy} onClick={() => setAction({ type:'redeem' })}>確認已交付實體酒單</Button>}</section>}
    <h3>探索操作紀錄 · 最近 100 筆</h3>{data.events.map(event => <p key={event.id}>{drinks.find(drink => drink.id === event.drinkId)?.name} · {event.action === 'confirm' ? '確認' : '撤銷'} · {event.actor} · {event.createdAt} UTC{event.reason && ' · ' + event.reason}</p>)}
    </>}
    <Dialog open={Boolean(action)} onOpenChange={open => { if (!open && !busy) setAction(null); }}><DialogContent><DialogTitle>{action?.type === 'confirm' ? '確認酒款完成' : action?.type === 'revoke' ? '撤銷完成紀錄' : '兌換實體酒單'}</DialogTitle><DialogDescription>{playerId} · {drinks.find(drink => drink.id === action?.record?.drinkId)?.name || '十二杯探索獎勵'}。{action?.type === 'revoke' ? '撤銷會扣除此杯進度，並重新檢查兌換資格。' : action?.type === 'redeem' ? '確認實體酒單已交付；每位會員限兌換一次。' : '此操作會計入會員探索進度，並保存你的操作紀錄。'}</DialogDescription>
      {action?.type === 'revoke' && <label>撤銷原因<Input value={reason} onChange={e => setReason(e.target.value)} maxLength={200} disabled={busy} /></label>}
      <Button disabled={busy || (action?.type === 'revoke' && !reason.trim())} onClick={() => void apply()}>{busy ? '更新中…' : '確認操作'}</Button>
    </DialogContent></Dialog>
  </section>;
}
