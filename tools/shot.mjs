// CDP screenshot helper: real mobile viewport emulation + section scrolling.
// Usage: node shot.mjs <url> <width> <height> <outfile> [scrollSelector] [theme]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// PowerShell drops empty-string arguments when invoking a native program, which
// silently shifts every later positional argument (a theme of "dark" arrived as
// "6000"). Pass "-" for "leave this empty" and it is normalised below.
const raw = process.argv.slice(2);
const clean = (v, dflt = "") => (v === undefined || v === "-" ? dflt : v);
const [url, w, h, outfile] = raw;
const scrollSel = clean(raw[4]);
const theme = clean(raw[5]);
const jsCode = clean(raw[6]);
const waitMs = clean(raw[7], "2000");
const width = Number(w), height = Number(h);
// An ephemeral port per run. A fixed port silently attaches to a Chrome left
// over from an earlier run (or to any other app that grabbed it), which then
// serves the wrong profile — a stale `sb-theme`, a stale viewport — and the
// screenshot lies.
const port = 9400 + Math.floor(Math.random() * 500);
const profile = path.join(os.tmpdir(), "cdp-shot-" + Date.now());

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const proc = spawn(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", "--disable-extensions",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1200,900", "about:blank",
], { stdio: "ignore", detached: true });
proc.unref();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(pathname, init) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${pathname}`, init);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(200);
  }
  throw new Error("CDP not ready");
}

await json("/json/version");
const target = await json("/json/new?" + encodeURIComponent("about:blank"), { method: "PUT" });
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
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

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width, height, deviceScaleFactor: 2, mobile: width < 700,
  screenWidth: width, screenHeight: height,
});
if (theme) {
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{localStorage.setItem("sb-theme",${JSON.stringify(theme)})}catch(e){}`,
  });
}
await send("Page.navigate", { url });
await sleep(3500);
if (scrollSel) {
  await send("Runtime.evaluate", {
    expression: `document.documentElement.style.scrollBehavior="auto";document.querySelector(${JSON.stringify(scrollSel)})?.scrollIntoView({block:"start"})`,
  });
  await sleep(1200);
}
if (jsCode) {
  await send("Runtime.evaluate", { expression: jsCode, awaitPromise: true });
  await sleep(Number(waitMs) || 2000);
}
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.writeFileSync(outfile, Buffer.from(shot.result.data, "base64"));
console.log("saved", outfile, width + "x" + height);
ws.close();
try { process.kill(proc.pid); } catch {}
process.exit(0);
