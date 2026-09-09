"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  CircleUserRound,
  BriefcaseBusiness,
  Fish,
  ChartPie,
  Crown,
  Shuffle,
  LogIn,
  History,
  Home,
  Martini,
  Sparkles,
  Swords,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { MemberPanel } from "@/components/member-panel";
import { MenuBoard } from "@/components/menu-board";
import type { Member } from "@/lib/member-types";

type Role = "高級牛馬" | "摸魚大師" | "畫餅充飢" | "人生勝利組";
type Tab = "home" | "roles" | "history" | "menu" | "member";
type DrawRecord = {
  id: number | string;
  role: string;
  reward: string;
  createdAt: string;
  saved?: boolean;
};

const roles: Array<{
  name: Role;
  code: string;
  desc: string;
  color: string;
  Icon: typeof Crown;
}> = [
  { name: "高級牛馬", code: "01", desc: "努力滿格，今晚犒賞自己", color: "#23a7ff", Icon: BriefcaseBusiness },
  { name: "摸魚大師", code: "02", desc: "忙裡偷閒，快樂準時下班", color: "#16e0bc", Icon: Fish },
  { name: "畫餅充飢", code: "03", desc: "夢想很大，先來一杯再說", color: "#a861ff", Icon: ChartPie },
  { name: "人生勝利組", code: "04", desc: "自帶光環，今晚由你閃耀", color: "#ffb648", Icon: Crown },
];

export default function HomePage() {
  const [member, setMember] = useState<Member | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState("");
  const [totalDraws, setTotalDraws] = useState(0);
  const [favoriteRole, setFavoriteRole] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [tab, setTab] = useState<Tab>("home");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [result, setResult] = useState<DrawRecord | null>(null);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const accountRevision = useRef(0);
  const [randomizing, setRandomizing] = useState(false);
  const [litRole, setLitRole] = useState<Role | null>(null);
  const randomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionBusy = useRef(false);
  useEffect(() => () => { if (randomTimer.current) clearTimeout(randomTimer.current); }, []);

  function randomRole() {
    if (actionBusy.current) return;
    actionBusy.current = true;
    setRandomizing(true); setResult(null); setSelectedRole(null);
    const target = crypto.getRandomValues(new Uint8Array(1))[0] % roles.length;
    const lastStep = 12 + target;
    let step = 0;
    const tick = () => {
      setLitRole(roles[step % roles.length].name);
      if (step === lastStep) {
        setSelectedRole(roles[target].name);
        setLitRole(null); setRandomizing(false); actionBusy.current = false;
        toast.success(`你的角色是：${roles[target].name}`);
        return;
      }
      step++;
      randomTimer.current = setTimeout(tick, 70 + Math.pow(step / lastStep, 3) * 240);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) step = lastStep;
    tick();
  }
  const refreshMember = useCallback(async () => {
    const revision = ++accountRevision.current;
    try {
      const response = await fetch("/api/member");
      if (!response.ok) throw new Error("暫時無法讀取會員資料。");
      const data = await response.json() as { member: Member | null };
      if (revision !== accountRevision.current) return;
      setMember(data.member); setMemberError("");
      setRecords([]); setResult(null); setTotalDraws(0); setFavoriteRole(null);
    } catch (error) {
      setMemberError((error as Error).message);
      throw error;
    } finally { setMemberLoading(false); }
  }, []);
  useEffect(() => {
    // Synchronize the initial session with the server; state updates follow the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshMember().catch(() => {});
  }, [refreshMember]);


  const currentRole = useMemo(
    () => roles.find((role) => role.name === selectedRole),
    [selectedRole],
  );

  const loadHistory = useCallback(async () => {
    if (!member) return;
    const revision = accountRevision.current;
    setRecordsLoading(true); setHistoryError("");
    try {
      const response = await fetch("/api/draws");
      if (response.status === 401) { await refreshMember(); throw new Error("登入已過期，請重新登入。"); }
      if (!response.ok) throw new Error("暫時無法讀取冒險紀錄");
      const data = (await response.json()) as { records: DrawRecord[]; total: number; favoriteRole: string | null };
      if (revision !== accountRevision.current) return;
      setRecords(data.records); setTotalDraws(data.total); setFavoriteRole(data.favoriteRole);
    } catch (error) {
      setHistoryError((error as Error).message);
    } finally {
      setRecordsLoading(false);
    }
  }, [member, refreshMember]);

  useEffect(() => {
    // Load server-owned history when this view or the signed-in member changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "history") void loadHistory();
  }, [tab, loadHistory]);

  async function handleUnlock() {
    if (unlocking || unlocked) return;
    setUnlocking(true);
    await new Promise((resolve) => setTimeout(resolve, 1350));
    setUnlocking(false);
    setUnlocked(true);
    toast.success("門鎖已解開，歡迎進入 re:world");
    window.setTimeout(() => setUnlocked(false), 5000);
  }

  async function drawReward() {
    if (!selectedRole || actionBusy.current) return;
    actionBusy.current = true;
    const revision = accountRevision.current;
    setDrawing(true);
    setResult(null);
    try {
      const response = await fetch("/api/draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: selectedRole,
        }),
      });
      const data = (await response.json()) as { record?: DrawRecord; error?: string };
      if (response.status === 401) { await refreshMember(); setTab("member"); }
      if (!response.ok || !data.record) throw new Error(data.error ?? "draw failed");
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (revision !== accountRevision.current) return;
      setResult(data.record);
      toast.success(data.record.saved ? "獎勵已存入你的冒險紀錄" : "獲得角色專屬獎勵！");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDrawing(false);
      actionBusy.current = false;
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient-grid" aria-hidden="true" />
      <section className="phone-app">
        <header className="topbar">
          <button className="profile-button" aria-label="會員資料" onClick={() => setTab("member")}>
            <CircleUserRound size={21} />
          </button>
          <div className="brand" aria-label="re world">
            <span>re:</span>world
          </div>
          <div className="system-status"><i /> ONLINE</div>
        </header>

        <div className="content">
          {tab === "home" && (
            <div className="screen home-screen">
              <div className="eyebrow">ACCESS TERMINAL · 01</div>
              <div className="welcome-row">
                <div>
                  <p>{member ? `歡迎回來，${member.displayName}` : "歡迎來到 re:world"}</p>
                  <h1>今晚，解鎖另一個你</h1>
                </div>
                <span className="level-chip">LV. 01</span>
              </div>

              <button
                className={`unlock-core ${unlocking ? "is-scanning" : ""} ${unlocked ? "is-unlocked" : ""}`}
                onClick={handleUnlock}
                aria-live="polite"
              >
                <span className="unlock-rings" aria-hidden="true" />
                <span className="unlock-icon">
                  {unlocked ? <Unlock size={38} /> : <LogIn size={38} />}
                </span>
                <strong>{unlocking ? "驗證中" : unlocked ? "已解鎖" : "登入 re:world"}</strong>
                <small>{unlocking ? "SCANNING ACCESS" : unlocked ? "ACCESS GRANTED" : "TAP TO ACCESS"}</small>
              </button>

              <div className="connection-strip">
                <div><span className="signal-dot" />門鎖模擬模式</div>
                <span>尚未串接設備</span>
              </div>

              <button className="mission-card" onClick={() => setTab("roles")}>
                <span className="mission-icon"><Swords size={23} /></span>
                <span>
                  <small>NEXT MISSION</small>
                  <strong>{selectedRole ? `目前角色：${selectedRole}` : "選擇你的角色"}</strong>
                </span>
                <ChevronRight size={21} />
              </button>
            </div>
          )}

          {tab === "roles" && (
            <div className="screen roles-screen">
              <div className="eyebrow">ROLE SELECT · 02</div>
              <h1>選擇你的角色</h1>
              <p className="screen-copy">點選角色，獲得角色專屬獎勵</p>

              <div className="role-grid">
                {roles.map(({ name, code, desc, color, Icon }) => (
                  <button
                    key={name}
                    className={`role-card ${selectedRole === name ? "is-selected" : ""} ${litRole === name ? "is-lit" : ""}`}
                    disabled={drawing || randomizing}
                    aria-pressed={selectedRole === name}
                    aria-label={name}
                    style={{ "--role-color": color } as React.CSSProperties}
                    onClick={() => { setSelectedRole(name); setResult(null); }}
                  >
                    <span className="role-code">{code}</span>
                    <span className="role-emblem"><Icon size={34} strokeWidth={1.7} /></span>
                    <strong>{name}</strong>
                    <small>{desc}</small>
                    {selectedRole === name && <span className="selected-mark"><Check size={13} /></span>}
                  </button>
                ))}
              </div>

              {!result ? (
                <button className="primary-action" disabled={drawing || randomizing || !selectedRole} onClick={drawReward}>
                  <Sparkles size={18} />
                  {drawing ? "正在抽取獎勵…" : randomizing ? "正在選擇角色…" : selectedRole ? `使用${selectedRole}抽取獎勵` : "請先選擇角色"}
                </button>
              ) : (
                <div className="reward-module" style={{ "--role-color": currentRole?.color } as React.CSSProperties}>
                  <span>REWARD ACQUIRED</span>
                  <strong>{result.reward}</strong>
                  <p>{result.role}專屬獎勵{result.saved ? "已記錄" : "已獲得"}</p>
                  <button onClick={() => setTab("history")}>查看冒險紀錄 <ChevronRight size={16} /></button>
                </div>
              )}
              <button className="random-role-action" onClick={randomRole} disabled={drawing || randomizing}>
                <Shuffle size={20} />{randomizing ? "命運選角中…" : "隨機選擇角色"}
              </button>
              <p className="guest-draw-note" role="status">{randomizing ? "燈框正在選擇角色…" : selectedRole ? `已選擇：${selectedRole}` : "四種角色，讓命運替你決定。"}</p>
              {!member && <p className="guest-draw-note">不用登入也能抽獎；登入後的抽獎會保存至冒險紀錄。</p>}
            </div>
          )}

          {tab === "menu" && <MenuBoard />}
          {tab === "member" && <MemberPanel member={member} loading={memberLoading} error={memberError} onRefresh={refreshMember} />}
          {tab === "history" && (
            <div className="screen history-screen">
              <div className="eyebrow">PLAYER LOG · 03</div>
              <h1>冒險紀錄</h1>
              <p className="screen-copy">每一次選擇，都會成為你的角色資料。</p>

              {!member ? <div className="empty-state"><History size={28} /><strong>登入後查看你的冒險紀錄</strong><button className="primary-action" onClick={() => setTab("member")}>登入／註冊</button></div> : <>
              <div className="stats-row">
                <div><span>總抽取</span><strong>{totalDraws}</strong></div>
                <div><span>主要角色</span><strong>{favoriteRole ?? "—"}</strong></div>
              </div>

              <div className="record-list">
                {recordsLoading && <div className="empty-state">正在同步玩家資料…</div>}
                {historyError && <div className="empty-state"><p role="alert">{historyError}</p><button className="primary-action" onClick={() => void loadHistory()}>重新讀取</button></div>}
                {!recordsLoading && !historyError && records.length === 0 && (
                  <div className="empty-state">
                    <History size={28} />
                    <strong>尚無冒險紀錄</strong>
                    <span>完成第一次角色抽卡後會顯示在這裡。</span>
                  </div>
                )}
                {!recordsLoading && !historyError && records.map((record) => {
                  const role = roles.find((item) => item.name === record.role) ?? roles[0];
                  const RoleIcon = role.Icon;
                  return (
                    <article className="record-row" key={record.id}>
                      <span className="record-emblem" style={{ "--role-color": role.color } as React.CSSProperties}>
                        <RoleIcon size={20} />
                      </span>
                      <span className="record-main">
                        <strong>{record.role}</strong>
                        <small>{new Date(record.createdAt.includes("T") ? record.createdAt : record.createdAt.replace(" ", "T") + "Z").toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</small>
                      </span>
                      <span className="record-reward">{record.reward}</span>
                    </article>
                  );
                })}
              </div>
              </>}
            </div>
          )}
        </div>

        <nav className="bottom-nav" aria-label="主要導覽">
          <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><Home /><span>首頁</span></button>
          <button className={tab === "roles" ? "active" : ""} onClick={() => setTab("roles")}><Swords /><span>選擇角色</span></button>
          <button className={tab === "menu" ? "active" : ""} onClick={() => setTab("menu")}><Martini /><span>菜單</span></button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History /><span>冒險紀錄</span></button>
          <button className={tab === "member" ? "active" : ""} onClick={() => setTab("member")}><CircleUserRound /><span>會員</span></button>
        </nav>
      </section>
      <Toaster position="top-center" richColors />
    </main>
  );
}
