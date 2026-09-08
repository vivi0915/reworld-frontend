"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleUserRound, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Member } from "@/lib/member-types";

async function submit(path: string, method: string, data?: Record<string, unknown>) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "操作失敗，請稍後再試。");
  return result;
}

export function MemberPanel({ member, loading, error, onRefresh }: { member: Member | null; loading: boolean; error: string; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setMessage(""); setFailed(false);
    if (!member && mode === "register" && data.password !== data.confirmPassword) {
      setFailed(true); setMessage("兩次密碼不一致，請重新確認。"); return;
    }
    setBusy(true);
    try {
      await submit(member ? "/api/member" : `/api/member/${mode}`, member ? "PATCH" : "POST", data);
      await onRefresh();
      setMessage(member ? "會員資料已儲存。" : mode === "register" ? "註冊成功，歡迎加入 re:world！" : "登入成功。");
    } catch (error) { setFailed(true); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setMessage(""); setFailed(false);
    try { await submit("/api/member/logout", "POST"); await onRefresh(); setMessage("已登出。"); }
    catch (error) { setFailed(true); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="screen member-screen">
    <div className="eyebrow">PLAYER ID · 05</div>
    <h1>{member ? "會員資料" : "加入 re:world"}</h1>
    <p className="screen-copy">{member ? "你的會員資料與冒險紀錄，隨帳號一起保存。" : "登入或註冊，保存每一次屬性選擇與獎勵。"}</p>
    {loading ? <p className="empty-state" role="status">正在讀取會員資料…</p> : error ? <div className="empty-state"><p role="alert">{error}</p><Button onClick={() => { void onRefresh().catch(() => {}); }}>重新讀取</Button></div> : <>
      {member ? <div className="member-card"><CircleUserRound size={38} /><div><strong>{member.displayName}</strong><span>@{member.username}</span><small>加入日期：{member.createdAt.slice(0, 10)}</small></div></div> : <Tabs value={mode} onValueChange={value => { setMode(value); setMessage(""); }} className="auth-tabs"><TabsList aria-label="會員登入或註冊"><TabsTrigger value="login" disabled={busy}>登入</TabsTrigger><TabsTrigger value="register" disabled={busy}>註冊</TabsTrigger></TabsList></Tabs>}
      <form className="member-form" onSubmit={handleSubmit} key={`${member?.id ?? "guest"}-${mode}`}>
        {!member && <label>帳號<Input name="username" required minLength={2} maxLength={24} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="可使用暱稱或本名" disabled={busy} /><small>2–24 個中文、英文、數字或底線；英文不分大小寫。</small></label>}
        {(member || mode === "register") && <label>暱稱或本名<Input name="displayName" required maxLength={40} autoComplete="nickname" defaultValue={member?.displayName} placeholder="希望我們怎麼稱呼你？" disabled={busy} /></label>}
        {!member && <label>密碼<Input name="password" type="password" required minLength={12} maxLength={128} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="至少 12 個字元" disabled={busy} /></label>}
        {!member && mode === "register" && <label>確認密碼<Input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="再次輸入密碼" disabled={busy} /></label>}
        {(member || mode === "register") && <>
          <label>聯絡電話 <span>選填</span><Input name="phone" type="tel" maxLength={24} autoComplete="tel" defaultValue={member?.phone} disabled={busy} /></label>
          <label>Email <span>選填</span><Input name="email" type="email" maxLength={254} autoComplete="email" defaultValue={member?.email} disabled={busy} /></label>
          <p className="form-note">暱稱及選填聯絡資料會儲存為 re:world 的會員資料，供店家提供會員服務。</p>
        </>}
        <Button type="submit" className="primary-action" disabled={busy}>{busy ? "處理中…" : member ? "儲存會員資料" : mode === "register" ? "建立會員帳號" : "登入"}</Button>
      </form>
      {member && <Button variant="outline" className="logout-action" onClick={logout} disabled={busy}><LogOut size={16} />登出</Button>}
      {message && <p className={failed ? "form-message error" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
      {member?.accessRole === "admin" && <MemberDirectory />}
    </>}
  </div>;
}

function MemberDirectory() {
  const [page, setPage] = useState(0);
  const [members, setMembers] = useState<Array<Member & { drawCount: number }>>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/members?page=${page}`, { signal: controller.signal }).then(async response => {
      const data = await response.json() as { error?: string; members: Array<Member & { drawCount: number }>; hasMore: boolean };
      if (!response.ok) throw new Error(data.error);
      setMembers(data.members); setHasMore(data.hasMore);
    }).catch(error => { if (error.name !== "AbortError") setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry]);
  function changePage(next: number) { setLoading(true); setError(""); setMembers([]); setPage(next); }
  return <section className="member-directory">
    <h2><ShieldCheck size={20} />店家會員名單</h2>
    {loading && <p role="status">正在讀取名單…</p>}
    {error && <><p role="alert">{error}</p><Button onClick={() => { setLoading(true); setError(""); setRetry(value => value + 1); }}>重試</Button></>}
    {!loading && !error && <><p className="form-note">第 {page + 1} 頁 · 此頁 {members.length} 位會員</p>{members.map(item => <article className="directory-entry" key={item.id}><strong>{item.displayName}</strong><span>@{item.username}</span><span>電話：{item.phone || "未填寫"}</span><span>Email：{item.email || "未填寫"}</span><small>加入 {item.createdAt.slice(0, 10)} · 抽卡 {item.drawCount} 次</small></article>)}<div className="directory-pagination"><Button variant="outline" disabled={page === 0} onClick={() => changePage(page - 1)}>上一頁</Button><Button variant="outline" disabled={!hasMore} onClick={() => changePage(page + 1)}>下一頁</Button></div></>}
  </section>;
}
