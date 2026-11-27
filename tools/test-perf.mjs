// Perf + reduced-motion checks for the 3D visualization.
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const url = process.argv[2] || "http://127.0.0.1:8899/";
const port = 9337;
const profile = path.join(os.tmpdir(), "cdp-perf-" + Date.now());
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proc = spawn(chrome, [
  "--headless=new", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1440,1000", "about:blank",
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
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((r) => pending.set(mid, r));
};
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

// --- perf: count frames while the section is on screen ---
await send("Page.navigate", { url: url });
await sleep(2500);
await evaluate(`document.documentElement.style.scrollBehavior="auto";document.querySelector('#steps').scrollIntoView()`);
await sleep(800);
const fps = await evaluate(`new Promise((resolve) => {
  let frames = 0;
  const t0 = performance.now();
  function loop(now) {
    frames++;
    if (now - t0 < 3000) requestAnimationFrame(loop);
    else resolve(Math.round(frames / ((now - t0) / 1000)));
  }
  requestAnimationFrame(loop);
})`);
console.log(`fps: ${fps}`);
if (fps < 40) console.log("WARN: low frame rate");

// --- reduced motion: should paint a static frame and not animate ---
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await send("Page.navigate", { url: url });
await sleep(2600);
await evaluate(`document.querySelector('#steps').scrollIntoView()`);
await sleep(900);
const painted = await evaluate(`(() => {
  const c = document.querySelector('#stepCanvas');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, Math.min(c.height, 200)).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i+1] + d[i+2] > 90) lit++;
  return lit;
})()`);
console.log(`static frame lit pixels (top band): ${painted}`);
const moved = await evaluate(`new Promise((resolve) => {
  let frames = 0;
  const t0 = performance.now();
  function loop(now) {
    frames++;
    if (now - t0 < 1500) requestAnimationFrame(loop);
    else resolve(frames);
  }
  requestAnimationFrame(loop);
})`);
console.log(`rAF ticks in 1.5s (other animations only): ${moved}`);

const ok = fps >= 40 && painted > 500;
console.log(ok ? "\nPASS perf + reduced motion" : "\nFAIL perf + reduced motion");
ws.close();
try { process.kill(proc.pid); } catch {}
process.exit(ok ? 0 : 1);
