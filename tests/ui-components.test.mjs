import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  cacheDir: '.sites-runtime/ui-test-vite-cache',
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false, watch: null },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("Guest menu contains twelve drinks and two dice without personal completion state", async () => {
  const { MenuBoard } = await vite.ssrLoadModule("/components/menu-board.tsx");
  const html = renderToStaticMarkup(React.createElement(MenuBoard,{member:null,memberLoading:false,memberError:'',onRefresh:async()=>{},registrationEnabled:true}));
  assert.equal((html.match(/class="menu-tile /g)||[]).length,12);
  assert.match(html,/登入會員，記錄你的探索進度；集滿 12 杯，解鎖實體酒單。/);
  assert.match(html,/登入／註冊/);
  assert.match(html,/骰子 1：1 點/);assert.match(html,/骰子 2：1 點/);
  assert.doesNotMatch(html,/DISCOVERED|tile-state|只骰未完成酒款/);
});

test("dice totals match clockwise travel for all starts and eligible destinations", async () => {
  const {rollMenuDice,drinks}=await vite.ssrLoadModule("/lib/menu-catalog.ts");
  for(let position=0;position<12;position++){
    for(const pool of [drinks.map((_,i)=>i),[0,3,7,11],[position]]){
      const targets=[];
      for(let pick=0;pick<pool.length;pick++){
        const result=rollMenuDice(position,pool,size=>{assert.equal(size,pool.length);return pick;});
        targets.push(result.target);
        assert.equal((position+result.steps)%12,result.target);
        assert.equal(result.dice[0]+result.dice[1],result.steps);
        assert.ok(result.steps>=1 && result.steps<=12);
        assert.ok(result.dice.every(n=>n>=0 && n<=6));
        if(result.steps===1) assert.deepEqual(result.dice,[1,0]);
        else assert.ok(result.dice.every(n=>n>=1));
        if(result.target===position) assert.equal(result.steps,12);
      }
      assert.deepEqual(targets,pool);
    }
  }
  assert.throws(()=>rollMenuDice(0,[]));
  assert.throws(()=>rollMenuDice(0,[0,0]));
});

test("menu order preserves existing exploration IDs", async () => {
  const {drinks}=await vite.ssrLoadModule("/lib/menu-catalog.ts");
  assert.deepEqual(drinks.filter(d=>d.number===1).map(d=>d.role),['摸魚大師','高級牛馬','畫餅充飢','人生勝利組']);
  assert.deepEqual(drinks.filter(d=>d.number===1).map(d=>[d.code,d.id,d.color]), [['01','role-02-drink-1','#16e0bc'],['02','role-01-drink-1','#23a7ff'],['03','role-03-drink-1','#a861ff'],['04','role-04-drink-2','#ff7048']]);
  assert.deepEqual(drinks.filter(d=>d.code==='04').map(d=>[d.name,d.number,d.id,d.alcoholLevel]),[
    ['財富自由',1,'role-04-drink-2',1],
    ['富二代',2,'role-04-drink-1',2],
    ['金湯匙',3,'role-04-drink-3',3],
  ]);
});
