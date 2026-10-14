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

test("ordered dice pairs distribute equally for every eligible pool size", async () => {
  const {rollMenuDice,drinks}=await vite.ssrLoadModule("/lib/menu-catalog.ts");
  assert.equal(new Set(drinks.map(d=>d.id)).size,12);
  assert.deepEqual([...new Set(drinks.map(d=>d.color))],['#23a7ff','#16e0bc','#ff7048','#a861ff']);
  for(let count=1;count<=12;count++){
    const frequency=Array(count).fill(0), limit=36-36%count;
    for(let pair=0;pair<limit;pair++){
      const values=[Math.floor(pair/6),pair%6];
      const result=rollMenuDice(count,()=>values.shift());
      frequency[result.index]++;
      assert.equal((result.dice[0]-1)*6+result.dice[1]-1,pair);
    }
    assert.ok(frequency.every(n=>n===limit/count));
  }
  const rejectedThenAccepted=[5,5,0,0]; // 35 is rejected for seven eligible drinks.
  assert.equal(rollMenuDice(7,()=>rejectedThenAccepted.shift()).index,0);
  assert.equal(rejectedThenAccepted.length,0);
});
