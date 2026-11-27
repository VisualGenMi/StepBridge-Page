// Runtime checks for the 3D step-compression visualization.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const url = process.argv[2] || "http://127.0.0.1:8899/";
const port = 9336;
const profile = path.join(os.tmpdir(), "cdp-steps-" + Date.now());
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
const errors = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") {
    errors.push(msg.params.exceptionDetails?.exception?.description || "exception");
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((res) => pending.set(mid, res));
};
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}
async function shot(name) {
  const s = await send("Page.captureScreenshot", { format: "png" });
  const buf = Buffer.from(s.result.data, "base64");
  const file = path.join(os.tmpdir(), name + ".png");
  fs.writeFileSync(file, buf);
  return crypto.createHash("sha1").update(buf).digest("hex");
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(2500);
await evaluate(`document.documentElement.style.scrollBehavior="auto";document.querySelector('#steps').scrollIntoView()`);
await sleep(1500);

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail });

check("canvas present", await evaluate("!!document.querySelector('#stepCanvas')"));
const size = await evaluate("(() => { const c = document.querySelector('#stepCanvas'); return [c.width, c.height]; })()");
check("canvas has pixels", size[0] > 500 && size[1] > 200, size.join("x"));

const hud50 = await evaluate("document.querySelector('[data-hud=\"nfe\"]').textContent");
check("starts at 50 steps", hud50 === "50", hud50);

const a = await shot("step-frame-a");
await sleep(700);
const b = await shot("step-frame-b");
check("animation is running", a !== b);

// auto-advance to the 4-step stage within one cycle
await sleep(5600);
const hud4 = await evaluate("document.querySelector('[data-hud=\"nfe\"]').textContent");
check("auto-advances to 4 steps", hud4 === "4", hud4);

// manual selection pins the stage instead of cycling
await evaluate(`document.querySelector('[data-step="2"]').click()`);
await sleep(900);
const hud2 = await evaluate("document.querySelector('[data-hud=\"nfe\"]').textContent");
const isTwo = await evaluate("document.querySelector('#stepviz').classList.contains('is-2step')");
check("tab selects 2 steps", hud2 === "2", hud2);
check("anchor callout appears", isTwo === true);
check("aria-selected follows", await evaluate(`document.querySelector('[data-step="2"]').getAttribute('aria-selected') === 'true'`));

const latency = await evaluate("document.querySelector('[data-hud=\"latency\"]').textContent");
check("HUD metrics update", latency.startsWith("1.84"), latency);

check("no runtime errors", errors.length === 0, errors.slice(0, 2).join(" | "));

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? "  (" + r.detail + ")" : ""}`));
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
ws.close();
try { process.kill(proc.pid); } catch {}
process.exit(failed.length ? 1 : 0);
