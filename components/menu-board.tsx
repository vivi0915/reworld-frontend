"use client";

import { useEffect, useRef, useState } from "react";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, MapPin, Martini } from "lucide-react";
import { Button } from "@/components/ui/button";

const groups = [
  { role: "高級牛馬", code: "01", color: "#23a7ff" },
  { role: "摸魚大師", code: "02", color: "#16e0bc" },
  { role: "人生勝利組", code: "04", color: "#ff7048" },
  { role: "畫餅充飢", code: "03", color: "#a861ff" },
];
const stops = groups.flatMap(group => [1, 2, 3].map(number => ({
  ...group, name: `${group.role} ${number}`, category: `${group.code} · ${group.role}專屬`,
  description: "酒名、風味與價格待確認。", number,
})));
const positions = [[1,1],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[4,3],[4,2],[4,1],[3,1],[2,1]];
const diceIcons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export function MenuBoard() {
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [message, setMessage] = useState("從高級牛馬 1 出發，也可以直接點選菜單格。");
  const running = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  function roll() {
    if (running.current) return;
    running.current = true;
    setRolling(true);
    setMessage("骰子滾動中…");
    // Rejection sampling avoids modulo bias for the six possible outcomes.
    let value: number;
    do { value = crypto.getRandomValues(new Uint8Array(1))[0]; } while (value >= 252);
    const result = value % 6 + 1;
    for (let i = 1; i <= 6; i++) timers.current.push(setTimeout(() => setDice(i % 6 + 1), i * 75));
    timers.current.push(setTimeout(() => {
      setDice(result);
      setMessage(`擲出 ${result} 點，前進 ${result} 格。`);
      for (let step = 1; step <= result; step++) {
        timers.current.push(setTimeout(() => {
          const next = (position + step) % stops.length;
          setPosition(next);
          setSelected(next);
          if (step === result) {
            setMessage(`擲出 ${result} 點，抵達「${stops[next].name}」。`);
            setRolling(false);
            running.current = false;
            timers.current = [];
          }
        }, step * 180));
      }
    }, 550));
  }

  const Dice = diceIcons[dice - 1];
  const item = stops[selected];
  return <div className="screen menu-screen">
    <div className="eyebrow">FLAVOR MAP · 04</div>
    <h1>風味大富翁</h1>
    <p className="screen-copy">擲骰子探索菜單，讓下一格決定今晚的靈感。</p>
    <p className="demo-note">四種角色 × 各三杯 · 酒名與價格待確認</p>
    <div className="menu-board" aria-label="環形菜單地圖，順時針前進">
      {stops.map((stop, i) => <button key={stop.name} className={`menu-tile ${selected === i ? "selected" : ""} ${position === i ? "occupied" : ""}`} style={{ gridRow: positions[i][0], gridColumn: positions[i][1], "--tile-color": stop.color } as React.CSSProperties} onClick={() => setSelected(i)} disabled={rolling} aria-pressed={selected === i} aria-label={`${`第 ${i + 1} 格：${stop.name}`}${position === i ? "，目前位置" : ""}`}>
        <span className="tile-number">{stop.code}</span>
        <strong>{stop.name}</strong>
        {position === i && <MapPin size={17} className="board-token" aria-hidden="true" />}
      </button>)}
      <div className="board-center">
        <span>re:world</span>
        <Dice size={42} className={rolling ? "dice-rolling" : ""} aria-label={`${dice} 點`} />
        <small>順時針探索 →</small>
      </div>
    </div>
    <Button className="primary-action" onClick={roll} disabled={rolling}>{rolling ? "前進中…" : "擲骰子，探索下一站"}</Button>
    <p className="board-status" role="status">{message}</p>
    <article className="menu-detail" aria-live="polite">
      <div className="menu-detail-category"><Martini size={18} />{item.category}</div>
      <div className="menu-detail-heading"><h2>{item.name}</h2><strong>價格待確認</strong></div>
      <p>{item.description}</p>
      <small>探索菜單不會下單或產生費用。</small>
    </article>
  </div>;
}
