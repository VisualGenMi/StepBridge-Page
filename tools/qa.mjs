// Smoke-test the project page through the Chrome DevTools Protocol.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const url = process.argv[2] || "http://127.0.0.1:8899/";
const port = 9334;
const profile = path.join(os.tmpdir(), "cdp-qa-" + Date.now());
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const proc = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, "--window-size=1440,1000", "about:blank",
], { stdio: "ignore", detached: true });
proc.unref();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(p, init) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${p}`, init);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error("CDP not ready");
}

await getJson("/json/version");
const target = await getJson("/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push(msg.params.exceptionDetails?.exception?.description || "exception");
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res) => pending.set(mid, res));
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false,
});
await send("Page.navigate", { url });
await sleep(3000);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
}

check("title", (await evaluate("document.title")).includes("StepBridge"));
check("cinema playlist has 15 clips", (await evaluate("JSON.parse(document.querySelector('#videoData').textContent).length")) === 15);
check("wall renders six tiles", (await evaluate("document.querySelectorAll('.tile').length")) === 6);
check("wall is three columns", (await evaluate("getComputedStyle(document.querySelector('.cinema__wall')).gridTemplateColumns.split(' ').length")) === 3, "");
check("hero hosts the wall", (await evaluate("!!document.querySelector('.hero #cinema')")) === true);
check("fire-dragon 1.3B clip is gone", !(await evaluate("document.querySelector('#videoData').textContent")).includes("1.3B.DMD.fire_dragon"));
check("no model toggle left", (await evaluate("document.querySelectorAll('.cinema .segmented').length")) === 0);

// Scroll the whole page so lazy-loaded figures get requested.
await evaluate(`(async () => {
  document.documentElement.style.scrollBehavior = "auto";
  const step = 600;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 500));
})()`);
await sleep(1200);
check("figures loaded", await evaluate(`Array.from(document.images).filter(i => !i.closest('.cinema__thumb')).every(i => i.complete && i.naturalWidth > 0)`), await evaluate(`JSON.stringify(Array.from(document.images).filter(i => !i.closest('.cinema__thumb') && !(i.complete && i.naturalWidth > 0)).map(i => i.getAttribute('src')))`));
check("fonts ready", await evaluate("document.fonts.status === 'loaded'"));

check("hero emblem rendered", (await evaluate("document.querySelectorAll('.emblem__svg .emblem__steps').length")) === 1);
check("wordmark present", (await evaluate("document.querySelector('.wordmark')?.textContent")) === "StepBridge");
const aff = await evaluate("document.querySelector('.affil')?.textContent || ''");
check("affiliations updated", aff.includes("MiLM Plus, Xiaomi Inc.") && aff.includes("School of Computer Science, Wuhan University"), aff.trim().slice(0, 80));
check("hero tagline present", (await evaluate("document.querySelector('.hero__tagline')?.textContent || ''")).includes("2 NFE"));

check("abstract flowchart has 4 stages", (await evaluate("document.querySelectorAll('.flow__stage[data-stage]').length")) === 4);
const refLink = await evaluate(`(async () => {
  const mark = document.querySelector('.ref-mark[data-ref="2"]');
  mark.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  await new Promise(r => setTimeout(r, 120));
  const stage = document.querySelector('.flow__stage[data-stage="2"]');
  const lit = stage.classList.contains('is-lit');
  const others = [...document.querySelectorAll('.flow__stage')].filter(s => s !== stage && s.classList.contains('is-lit')).length;
  mark.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  return { lit, others, marks: document.querySelectorAll('.ref-mark').length };
})()`);
check("abstract markers light their stage", refLink.lit === true && refLink.others === 0 && refLink.marks === 4, JSON.stringify(refLink));



const autoPlay = await evaluate(`(async () => {
  document.querySelector('#videos').scrollIntoView();
  await new Promise(r => setTimeout(r, 1200));
  const tiles = [...document.querySelectorAll('.tile__video')].filter(v => v.getAttribute('src'));
  return { n: tiles.length, paused: tiles.filter(v => v.paused).length, src: tiles[0]?.getAttribute('src') || "" };
})()`);
const labelRow = await evaluate(`(() => {
  const tile = document.querySelector('.tile');
  const legend = tile.querySelector('.tile__legend');
  const vid = tile.querySelector('.tile__video');
  return {
    hasLegend: !!legend,
    text: legend ? legend.textContent.replace(/\s+/g, ' ').trim() : '',
    natural: [vid.videoWidth, vid.videoHeight],
    fit: getComputedStyle(vid).objectFit,
    ratio: getComputedStyle(tile.querySelector('.tile__frame')).aspectRatio,
  };
})()`);
check("pair labels are HTML, not baked in", labelRow.hasLegend && /Original/i.test(labelRow.text) && /StepBridge/i.test(labelRow.text), JSON.stringify(labelRow.text));
check("clips are 1664x480 without the title strip", labelRow.natural[0] === 1664 && labelRow.natural[1] === 480, JSON.stringify(labelRow.natural));
check("tiles never crop the frame", labelRow.fit === "contain", labelRow.fit);

check("wall autoplays six tiles", autoPlay.n === 6 && autoPlay.paused === 0 && autoPlay.src.includes("assets/videos/"), JSON.stringify(autoPlay));

const advanced = await evaluate(`(async () => {
  const before = document.querySelector('#cinemaPage').textContent;
  const t0 = document.querySelector('.tile__title').textContent;
  document.querySelector('#nextSet').click();
  await new Promise(r => setTimeout(r, 700));
  return { before, after: document.querySelector('#cinemaPage').textContent, t0, t1: document.querySelector('.tile__title').textContent };
})()`);
check("next set advances the wall", advanced.before !== advanced.after && advanced.t0 !== advanced.t1, JSON.stringify(advanced));

await evaluate(`document.querySelector('.chip[data-filter="ours"]').click()`);
await sleep(200);
check("table ours filter shows 3", (await evaluate("document.querySelectorAll('#mainTable tbody tr:not(.hide)').length")) === 3);
await evaluate(`document.querySelector('.chip[data-filter="all"]').click()`);
check("table full shows 14", (await evaluate("document.querySelectorAll('#mainTable tbody tr:not(.hide)').length")) === 14);

await evaluate(`document.querySelector('.table-tab[data-table="extra"]').click()`);
await sleep(250);
check("appendix table switches", await evaluate(`document.querySelector('.table-panel[data-panel="extra"]').classList.contains('is-active') && document.querySelectorAll('.table-panel[data-panel="extra"] tbody tr').length === 6`));
await evaluate(`document.querySelector('.table-tab[data-table="14b"]').click()`);
await sleep(250);
check("14B table shows 8 rows", (await evaluate("document.querySelectorAll('.table-panel[data-panel=\"14b\"] tbody tr').length")) === 8);
await evaluate(`document.querySelector('.table-tab[data-table="core"]').click()`);

const before = await evaluate("document.documentElement.dataset.theme");
await evaluate(`document.querySelector('#themeToggle').click()`);
const after = await evaluate("document.documentElement.dataset.theme");
check("theme toggles", before !== after);

const dialogOpen = await evaluate(`(async () => {
  const v = document.querySelector('.tile__video');
  v.click();
  await new Promise(r => setTimeout(r, 400));
  const open = document.querySelector('#lightbox').open === true;
  document.querySelector('#lbClose').click();
  return open;
})()`);
check("video lightbox opens", dialogOpen === true);

const imgZoom = await evaluate(`(async () => {
  document.querySelector('.figure__media[data-zoom]').click();
  await new Promise(r => setTimeout(r, 300));
  const open = document.querySelector('#lightbox').open === true;
  document.querySelector('#lbClose').click();
  return open;
})()`);
check("figure lightbox opens", imgZoom === true);

check("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
check("no horizontal overflow (desktop)", await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));

const anchorOk = await evaluate(`Array.from(document.querySelectorAll('a[href^="#"]'))
  .filter(a => a.getAttribute('href').length > 1)
  .every(a => document.querySelector(a.getAttribute('href')))`);
check("internal anchors resolve", anchorOk === true);

// --- 3D step viz + architecture diagram ---
const archCanvas = await evaluate(`(() => {
  const c = document.querySelector('#archCanvas');
  if (!c) return null;
  return [c.width, c.height];
})()`);
check("architecture canvas sized", archCanvas && archCanvas[0] > 500, archCanvas ? archCanvas.join("x") : "missing");

const archPainted = await evaluate(`(() => {
  const c = document.querySelector('#archCanvas');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 16) if (d[i] + d[i+1] + d[i+2] > 120) lit++;
  return lit;
})()`);
check("architecture canvas painted", archPainted > 2000, String(archPainted));

const signalSwap = await evaluate(`(async () => {
  const c = document.querySelector('#archCanvas');
  const grab = () => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 400) sum = (sum * 31 + d[i] + d[i+1] * 3 + d[i+2] * 7) % 1000000007;
    return sum;
  };
  const before = grab();
  document.querySelector('.chip[data-signal="anchor"]').click();
  await new Promise(r => setTimeout(r, 700));
  const after = grab();
  const active = document.querySelector('.chip[data-signal="anchor"]').classList.contains('is-active');
  document.querySelector('.chip[data-signal="all"]').click();
  return { changed: before !== after, active };
})()`);
check("signal chips change the diagram", signalSwap.changed === true && signalSwap.active === true, JSON.stringify(signalSwap));

const qWindow = await evaluate(`(async () => {
  document.querySelector('#method').scrollIntoView();
  await new Promise(r => setTimeout(r, 600));
  const canvas = document.querySelector('#archCanvas');
  const g = canvas.getContext('2d');
  const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 40) if (d[i] + d[i+1] + d[i+2] > 220) lit++;
  return { lit, painted: canvas.width > 400 };
})()`);
check("architecture diagram is animating", qWindow.painted && qWindow.lit > 500, JSON.stringify(qWindow));

const archErr = await evaluate(`(async () => {
  const before = window.__archErrors || 0;
  await new Promise(r => setTimeout(r, 700));
  return window.__archErrors || 0;
})()`);
check("architecture canvas draws without errors", archErr === 0, String(archErr));

const localAssets = await evaluate(`JSON.stringify([...new Set([
  ...Array.from(document.images).map(i => i.getAttribute('src')),
  ...Array.from(document.querySelectorAll('video')).map(v => v.getAttribute('data-src')),
  ...Array.from(document.querySelectorAll('video[poster]')).map(v => v.getAttribute('poster')),
  'assets/css/style.css', 'assets/js/main.js', 'assets/og.png', 'assets/favicon.svg'
].filter(Boolean))])`);
let badAssets = [];
for (const asset of JSON.parse(localAssets)) {
  try {
    const res = await fetch(new URL(asset, url).href, { method: "HEAD" });
    if (!res.ok) badAssets.push(asset + " (" + res.status + ")");
  } catch (e) {
    badAssets.push(asset + " (network)");
  }
}
check("all referenced assets return 200", badAssets.length === 0, badAssets.slice(0, 4).join(", "));

// Mobile pass: real 390px viewport.
await send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  screenWidth: 390, screenHeight: 844,
});
await send("Page.reload");
await sleep(2500);
check("no horizontal overflow (390px)", await evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"));
check("mobile menu toggles", await evaluate(`(async () => {
  const btn = document.querySelector('#navToggle');
  btn.click();
  await new Promise(r => setTimeout(r, 120));
  const open = document.querySelector('#navDrawer').classList.contains('is-open');
  btn.click();
  return open;
})()`));

const failures = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`);
}
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
ws.close();
try { process.kill(proc.pid); } catch {}
process.exit(failures.length ? 1 : 0);
