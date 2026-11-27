/* ==========================================================================
   StepBridge — "corridor of steps" 3D visualization
   A dependency-free canvas renderer: a twisting latent corridor whose gates
   are network evaluations. 50 -> 4 -> 2 steps keeps the endpoints fixed and
   stretches every transition.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("stepCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = document.getElementById("stepStage");
  const viz = document.getElementById("stepviz");
  const tabs = Array.from(document.querySelectorAll(".stepflow__node"));
  const progressEl = document.getElementById("stepProgress");
  const hud = {
    nfe: viz.querySelector('[data-hud="nfe"]'),
    label: viz.querySelector('[data-hud="label"]'),
    latency: viz.querySelector('[data-hud="latency"]'),
    total: viz.querySelector('[data-hud="total"]'),
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const STAGES = [
    { steps: 50, evals: 100, latency: "95.0", total: "83.38", label: "Multi-step teacher \u00b7 100 DiT evals" },
    { steps: 4, evals: 4, latency: "3.78", total: "84.24", label: "Four-step reference \u00b7 4 DiT evals" },
    { steps: 2, evals: 2, latency: "1.84", total: "83.78", label: "Two-step StepBridge \u00b7 2 DiT evals" },
  ];
  const CYCLE_MS = 6200;
  const HOLD_MS = 14000;

  /* ------------------------------------------------------------------ */
  /* geometry                                                            */
  /* ------------------------------------------------------------------ */

  const TURNS = 4.2;
  const SPAN = 23;
  const SAMPLES = 420;
  const PATH = [];

  function pathAt(u) {
    const r = 2.95 * Math.pow(1 - u, 1.08) + 0.16;
    const wob = Math.sin(u * Math.PI * 1.85 + 0.35);
    const wob2 = Math.cos(u * Math.PI * 1.32 + 1.05);
    return {
      x: (u - 0.5) * SPAN,
      y: wob * r,
      z: wob2 * r * 0.86,
      r,
    };
  }

  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1);
    const p = pathAt(u);
    const ahead = pathAt(Math.min(1, u + 0.002));
    const behind = pathAt(Math.max(0, u - 0.002));
    let tx = ahead.x - behind.x;
    let ty = ahead.y - behind.y;
    let tz = ahead.z - behind.z;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // perpendicular basis: b = up x t, n = t x b
    let bx = 0 * tz - 1 * ty;
    let by = 1 * tx - 0 * tz;
    let bz = 0 * ty - 1 * tx;
    let bl = Math.hypot(bx, by, bz) || 1;
    bx /= bl;
    by /= bl;
    bz /= bl;
    const nx = ty * bz - tz * by;
    const ny = tz * bx - tx * bz;
    const nz = tx * by - ty * bx;
    PATH.push({ u, x: p.x, y: p.y, z: p.z, r: p.r, tx, ty, tz, bx, by, bz, nx, ny, nz });
  }

  function sampleAt(u, out) {
    u = clamp(u, 0, 1);
    const fi = u * (SAMPLES - 1);
    const i0 = Math.min(SAMPLES - 2, Math.floor(fi));
    const t = fi - i0;
    const a = PATH[i0];
    const b = PATH[i0 + 1];
    const o = out || {};
    o.x = lerp(a.x, b.x, t);
    o.y = lerp(a.y, b.y, t);
    o.z = lerp(a.z, b.z, t);
    o.r = lerp(a.r, b.r, t);
    o.tx = lerp(a.tx, b.tx, t);
    o.ty = lerp(a.ty, b.ty, t);
    o.tz = lerp(a.tz, b.tz, t);
    o.bx = lerp(a.bx, b.bx, t);
    o.by = lerp(a.by, b.by, t);
    o.bz = lerp(a.bz, b.bz, t);
    o.nx = lerp(a.nx, b.nx, t);
    o.ny = lerp(a.ny, b.ny, t);
    o.nz = lerp(a.nz, b.nz, t);
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* camera / projection                                                  */
  /* ------------------------------------------------------------------ */

  let W = 1;
  let H = 1;
  let DPR = 1;
  let focal = 1;
  let cxp = 0;
  let cyp = 0;
  let gain = 1;

  const cam = {
    yaw: 0,
    pitch: -0.1,
    dist: 31,
    dolly: 0,
    steerX: 0,
    steerY: 0,
    dragYaw: 0,
    dragPitch: 0,
  };

  const pOut = { x: 0, y: 0, z: 0, s: 1 };

  function project(x, y, z) {
    let wx = x - cam.dolly;
    let wy = y;
    let wz = z;

    const cy = Math.cos(cam.yaw);
    const sy = Math.sin(cam.yaw);
    const x1 = wx * cy + wz * sy;
    const z1 = -wx * sy + wz * cy;

    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const y1 = wy * cp - z1 * sp;
    const z2 = wy * sp + z1 * cp;

    const d = cam.dist - z2;
    const s = focal / (d > 2 ? d : 2);
    pOut.x = cxp + x1 * s;
    pOut.y = cyp - y1 * s;
    pOut.z = z2;
    pOut.s = s;
    return pOut;
  }

  /* ------------------------------------------------------------------ */
  /* palette + sprites                                                    */
  /* ------------------------------------------------------------------ */

  const STOPS = ["#4f8fdc", "#6f86e0", "#8f7fdd", "#b387c9", "#d194ab", "#e2a07c"];
  const N_BUCKETS = 24;
  let palette = [];
  let sprites = [];

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function buildPalette() {
    const rgb = STOPS.map(hexToRgb);
    palette = [];
    for (let i = 0; i < N_BUCKETS; i++) {
      const t = (i / (N_BUCKETS - 1)) * (rgb.length - 1);
      const i0 = Math.min(rgb.length - 2, Math.floor(t));
      const f = t - i0;
      const c = [0, 1, 2].map((k) => Math.round(lerp(rgb[i0][k], rgb[i0 + 1][k], f)));
      palette.push(c);
    }
  }

  function buildSprites() {
    sprites = palette.map((c) => {
      const size = 32;
      const cv = document.createElement("canvas");
      cv.width = size;
      cv.height = size;
      const g = cv.getContext("2d");
      const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`);
      grad.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return cv;
    });
  }

  function bucketFor(u) {
    return clamp(Math.round(u * (N_BUCKETS - 1)), 0, N_BUCKETS - 1);
  }

  /* ------------------------------------------------------------------ */
  /* scene objects                                                        */
  /* ------------------------------------------------------------------ */

  let particles = [];
  const STREAKS = [];

  function buildParticles() {
    const count = W < 720 ? 300 : 680;
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        u: Math.random(),
        theta: Math.random() * Math.PI * 2,
        rho: 0.15 + Math.random() * 0.85,
        size: 0.7 + Math.random() * 1.9,
        speed: 0.028 + Math.random() * 0.05,
        swirl: (Math.random() - 0.5) * 1.6,
        px: null,
        py: null,
      });
    }
  }

  const STAR = [];
  for (let i = 0; i < 110; i++) {
    STAR.push({
      x: (Math.random() - 0.5) * 46,
      y: (Math.random() - 0.5) * 22,
      z: (Math.random() - 0.5) * 26,
      a: 0.12 + Math.random() * 0.5,
      r: Math.random() * 1.2,
    });
  }

  const gateCache = new Map();
  function gatesFor(N) {
    if (gateCache.has(N)) return gateCache.get(N);
    const gates = [];
    const segs = N <= 8 ? 48 : 26;
    const big = N <= 8;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = sampleAt(u, {});
      const R = big ? 2.15 + 1.65 * (1 - u) : Math.min(3.35, Math.max(0.62, p.r * 1.18 + 0.16));
      const ring = [];
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        const ca = Math.cos(a) * R;
        const sa = Math.sin(a) * R;
        ring.push({
          x: p.x + p.bx * ca + p.nx * sa,
          y: p.y + p.by * ca + p.ny * sa,
          z: p.z + p.bz * ca + p.nz * sa,
        });
      }
      gates.push({ u, ring, R });
    }
    gateCache.set(N, gates);
    return gates;
  }

  /* ------------------------------------------------------------------ */
  /* state                                                                */
  /* ------------------------------------------------------------------ */

  const state = {
    index: 0,
    prevIndex: 0,
    blend: 1,
    surge: 0,
    clock: 0,
    stageClock: 0,
    holdUntil: 0,
    running: false,
    raf: 0,
    last: 0,
  };

  function stageSteps() {
    return STAGES[state.index].steps;
  }

  /* ------------------------------------------------------------------ */
  /* drawing helpers                                                      */
  /* ------------------------------------------------------------------ */

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a1122");
    g.addColorStop(0.55, "#060a14");
    g.addColorStop(1, "#04060d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const b = ctx.createRadialGradient(W * 0.24, H * 0.28, 0, W * 0.24, H * 0.28, W * 0.55);
    b.addColorStop(0, "rgba(56,110,190,0.20)");
    b.addColorStop(1, "rgba(56,110,190,0)");
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, W, H);

    const w = ctx.createRadialGradient(W * 0.82, H * 0.72, 0, W * 0.82, H * 0.72, W * 0.45);
    w.addColorStop(0, "rgba(190,110,72,0.14)");
    w.addColorStop(1, "rgba(190,110,72,0)");
    ctx.fillStyle = w;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars() {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < STAR.length; i++) {
      const st = STAR[i];
      const p = project(st.x, st.y + Math.sin(state.clock * 0.2 + i) * 0.2, st.z);
      if (p.s <= 0) continue;
      const a = st.a * clamp(p.s * 22, 0.1, 1) * 0.5;
      ctx.fillStyle = `rgba(150,185,255,${a})`;
      ctx.fillRect(p.x, p.y, st.r, st.r);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawGrid() {
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1;
    const y = -6.2;
    for (let z = -12; z <= 12; z += 3) {
      ctx.beginPath();
      for (let x = -20; x <= 20; x += 2) {
        const p = project(x, y, z);
        if (x === -20) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(84,130,200,0.09)";
      ctx.stroke();
    }
    for (let x = -20; x <= 20; x += 4) {
      ctx.beginPath();
      for (let z = -12; z <= 12; z += 2) {
        const p = project(x, y, z);
        if (z === -12) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(84,130,200,0.07)";
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawSpine() {
    const s0 = sampleAt(0, {});
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = sampleAt(i / 120, s0);
      const q = project(p.x, p.y, p.z);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = "rgba(120,160,230,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  const tmp = {};

  function tubePoint(p, theta, rho) {
    const rr = p.r * rho;
    const c = Math.cos(theta) * rr;
    const s = Math.sin(theta) * rr;
    return {
      x: p.x + p.bx * c + p.nx * s,
      y: p.y + p.by * c + p.ny * s,
      z: p.z + p.bz * c + p.nz * s,
    };
  }

  function drawStrands() {
    ctx.globalCompositeOperation = "lighter";
    const STRANDS = 3;
    for (let sIdx = 0; sIdx < STRANDS; sIdx++) {
      const phase = (sIdx / STRANDS) * Math.PI * 2;
      let prev = null;
      for (let i = 0; i <= 150; i++) {
        const u = i / 150;
        const p = sampleAt(u, tmp);
        const th = phase + u * 2.4 + state.clock * 0.16;
        const pt = tubePoint(p, th, 0.58);
        const q = project(pt.x, pt.y, pt.z);
        if (prev && Math.abs(q.x - prev.x) < W && Math.abs(q.y - prev.y) < H) {
          const c = palette[bucketFor(u)];
          const a = 0.34 * gain * (0.35 + 0.65 * (1 - u * 0.35)) * clamp(q.s * 26, 0.2, 1.2);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
          ctx.lineWidth = clamp(q.s * 2.0, 0.6, 2.4);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
        prev = { x: q.x, y: q.y };
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawParticles(dt) {
    const speedBoost = 1 + state.surge * 2.6;
    for (let b = 0; b < N_BUCKETS; b++) STREAKS[b] && (STREAKS[b].length = 0);

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      pt.u += dt * pt.speed * speedBoost * (0.7 + pt.rho * 0.6);
      if (pt.u > 1) {
        pt.u -= 1;
        pt.theta = Math.random() * Math.PI * 2;
        pt.rho = 0.15 + Math.random() * 0.85;
        pt.px = null;
      }
      const p = sampleAt(pt.u, tmp);
      const th = pt.theta + state.clock * 0.32 * pt.swirl + pt.u * 1.6;
      const pp = tubePoint(p, th, pt.rho);
      const q = project(pp.x, pp.y, pp.z);

      const depthA = clamp((q.z + 12) / 24, 0.12, 1);
      const a = depthA * 0.85 * gain;
      const size = pt.size * clamp(q.s * 30, 0.6, 4.2) * (gain < 0.7 ? 0.75 : 1);

      if (pt.px !== null && Math.abs(q.x - pt.px) < 60 && Math.abs(q.y - pt.py) < 60) {
        const bi = bucketFor(pt.u);
        if (!STREAKS[bi]) STREAKS[bi] = [];
        STREAKS[bi].push(q.x, q.y, pt.px, pt.py);
      }
      pt.px = q.x;
      pt.py = q.y;

      const sprite = sprites[bucketFor(pt.u)];
      ctx.globalAlpha = a;
      ctx.drawImage(sprite, q.x - size, q.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;

    // batch the motion streaks per colour bucket
    for (let b = 0; b < N_BUCKETS; b++) {
      const seg = STREAKS[b];
      if (!seg || !seg.length) continue;
      const c = palette[b];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.22 * gain})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < seg.length; i += 4) {
        ctx.moveTo(seg[i], seg[i + 1]);
        ctx.lineTo(seg[i + 2], seg[i + 3]);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function strokeRing(ring, alpha, width, color) {
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const q = project(ring[i].x, ring[i].y, ring[i].z);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawGates(N, alpha) {
    if (alpha <= 0.01) return;
    const gates = gatesFor(N);
    const big = N <= 8;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      const u = g.u;
      const c = palette[bucketFor(u)];
      const isEdge = i === 0 || i === gates.length - 1;

      if (big) {
        strokeRing(g.ring, alpha * 0.16, 7, `rgba(${c[0]},${c[1]},${c[2]},1)`);
        strokeRing(g.ring, alpha * 0.85, 1.6, `rgba(${c[0]},${c[1]},${c[2]},1)`);
      } else {
        const everyTen = i % 10 === 0;
        const a = alpha * gain * (everyTen ? 0.42 : isEdge ? 0.34 : 0.19);
        strokeRing(g.ring, a, everyTen ? 1.5 : 1, `rgba(${c[0]},${c[1]},${c[2]},1)`);
      }

      // gate marker for the coarse budgets
      if (big && alpha > 0.5) {
        const p = sampleAt(u, tmp);
        const dot = project(p.x, p.y, p.z);
        ctx.globalAlpha = alpha * 0.9;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, clamp(dot.s * 3.4, 1.2, 4), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // number the transitions, not the gates: "2 steps" should look like two hops
    if (big && alpha > 0.5) {
      ctx.globalAlpha = alpha;
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N;
        const p = sampleAt(u, tmp);
        const label = project(p.x - p.nx * 1.7, p.y - p.ny * 1.7, p.z - p.nz * 1.7);
        const c = palette[bucketFor(u)];
        ctx.fillStyle = "rgba(9,14,26,0.78)";
        ctx.beginPath();
        ctx.arc(label.x, label.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(236,242,255,0.92)";
        ctx.font = "600 10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), label.x, label.y + 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // travelling light through each transition
    const comets = big ? gates.length - 1 : 9;
    for (let i = 0; i < comets; i++) {
      const span = big ? 1 / (gates.length - 1) : 1 / 9;
      const u0 = big ? i / (gates.length - 1) : i / 9;
      const phase = ((state.clock * 0.22 + i * 0.31) % 1 + 1) % 1;
      const u = u0 + phase * span;
      const p = sampleAt(u, tmp);
      const q = project(p.x, p.y, p.z);
      const c = palette[bucketFor(u)];
      const rad = clamp(q.s * (big ? 26 : 16), 5, 26);
      const grad = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
      grad.addColorStop(0, `rgba(255,255,255,${0.75 * alpha * gain})`);
      grad.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},${0.5 * alpha * gain})`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawBridge(alpha) {
    if (alpha <= 0.01) return;
    ctx.globalCompositeOperation = "lighter";
    const liftAt = (u) => 1.75 + Math.sin(u * Math.PI) * 0.85;

    // suspension hangers tying the anchor down to the trajectory
    for (let k = 1; k <= 8; k++) {
      const u = k / 9;
      const p = sampleAt(u, tmp);
      const a = project(p.x, p.y, p.z);
      const b = project(p.x, p.y + liftAt(u), p.z);
      ctx.strokeStyle = `rgba(255,190,156,${0.26 * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    let prev = null;
    for (let i = 0; i <= 160; i++) {
      const u = i / 160;
      const p = sampleAt(u, tmp);
      const q = project(p.x, p.y + liftAt(u), p.z);
      if (prev && i % 3 < 2) {
        ctx.strokeStyle = `rgba(255,178,140,${0.52 * alpha})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
      prev = { x: q.x, y: q.y };
    }

    // end caps: the anchor touches both ends of the trajectory
    [0, 1].forEach((u) => {
      const p = sampleAt(u, tmp);
      const q = project(p.x, p.y + liftAt(u), p.z);
      ctx.strokeStyle = `rgba(255,200,168,${0.6 * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, q.y, clamp(q.s * 5, 2.5, 6), 0, Math.PI * 2);
      ctx.stroke();
    });

    // a slow spark crossing the bridge
    const u = ((state.clock * 0.12) % 1 + 1) % 1;
    const p = sampleAt(u, tmp);
    const q = project(p.x, p.y + liftAt(u), p.z);
    const rad = clamp(q.s * 22, 6, 20);
    const grad = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
    grad.addColorStop(0, `rgba(255,236,224,${0.85 * alpha})`);
    grad.addColorStop(0.4, `rgba(255,160,120,${0.4 * alpha})`);
    grad.addColorStop(1, "rgba(255,140,100,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = "source-over";
  }

  // fixed cloud around the noisy end
  const CLOUD = [];
  for (let i = 0; i < 90; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const rr = 2.2 + Math.random() * 3.4;
    CLOUD.push({
      x: Math.sin(ph) * Math.cos(th) * rr,
      y: Math.sin(ph) * Math.sin(th) * rr * 0.8,
      z: Math.cos(ph) * rr,
      s: Math.random() * 1.6 + 0.6,
      ph: Math.random() * Math.PI * 2,
    });
  }

  function drawEndpoints() {
    const start = pathAt(0);
    const end = pathAt(1);
    ctx.globalCompositeOperation = "lighter";

    // noisy start: a jittering sphere of unresolved detail
    for (let i = 0; i < CLOUD.length; i++) {
      const c = CLOUD[i];
      const wob = 1 + Math.sin(state.clock * 0.9 + c.ph) * 0.16;
      const q = project(
        start.x + c.x * wob,
        start.y + c.y * wob,
        start.z + c.z * wob
      );
      const a = clamp((q.z + 12) / 24, 0.1, 1) * 0.32 * gain;
      ctx.globalAlpha = a;
      ctx.drawImage(sprites[bucketFor(0.02)], q.x - c.s * 6, q.y - c.s * 6, c.s * 12, c.s * 12);
    }
    ctx.globalAlpha = 1;

    // clean end: a calm bloom with expanding rings
    const e = project(end.x, end.y, end.z);
    const core = clamp(e.s * 40, 8, 34);
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, core * 2.6);
    g.addColorStop(0, `rgba(255,244,236,${0.95 * gain})`);
    g.addColorStop(0.3, `rgba(255,196,158,${0.55 * gain})`);
    g.addColorStop(1, "rgba(255,170,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(e.x, e.y, core * 2.6, 0, Math.PI * 2);
    ctx.fill();

    for (let k = 0; k < 3; k++) {
      const ph = ((state.clock * 0.32 + k / 3) % 1 + 1) % 1;
      const rr = (10 + ph * 46) * clamp(e.s * 26, 0.7, 1.6);
      ctx.strokeStyle = `rgba(255,200,166,${(1 - ph) * 0.35})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(e.x, e.y, clamp(e.s * 6, 2, 6), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ------------------------------------------------------------------ */
  /* frame                                                                */
  /* ------------------------------------------------------------------ */

  let lastDt = 0.016;

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();
    drawStars();
    drawGrid();
    drawSpine();
    drawStrands();

    const stepsNow = STAGES[state.index].steps;
    const stepsPrev = STAGES[state.prevIndex].steps;
    if (state.blend < 1 && stepsPrev !== stepsNow) {
      drawGates(stepsPrev, 1 - easeOut(state.blend));
    }
    drawGates(stepsNow, state.blend >= 1 ? 1 : easeOut(state.blend));

    drawBridge(stepsNow === 2 ? state.blend : 0);
    drawParticles(lastDt);
    drawEndpoints();
    drawVignette();
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function update(dt) {
    state.clock += dt;
    state.surge = Math.max(0, state.surge - dt * 2.2);

    const targetYaw = 0.38 + Math.sin(state.clock * 0.13) * 0.14 + cam.steerX * 0.3 + cam.dragYaw;
    const targetPitch = -0.1 + Math.sin(state.clock * 0.09) * 0.05 + cam.steerY * 0.12 + cam.dragPitch;

    cam.yaw += (targetYaw - cam.yaw) * Math.min(1, dt * 3.2);
    cam.pitch += (targetPitch - cam.pitch) * Math.min(1, dt * 3.2);
    cam.dolly = Math.sin(state.clock * 0.11) * 4.2;

    if (state.blend < 1) {
      state.blend = Math.min(1, state.blend + dt / 0.55);
    }
    lastDt = dt;
  }

  function tick(now) {
    if (!state.running) return;
    const dt = clamp((now - state.last) / 1000 || 0.016, 0.001, 0.05);
    state.last = now;
    update(dt);
    draw();
    advanceClock(dt);
    state.raf = requestAnimationFrame(tick);
  }

  function advanceClock(dt) {
    const ms = dt * 1000;
    if (performance.now() < state.holdUntil) {
      progressEl.style.transform = "scaleX(0)";
      return;
    }
    state.stageClock += ms;
    const p = clamp(state.stageClock / CYCLE_MS, 0, 1);
    progressEl.style.transform = `scaleX(${p})`;
    if (state.stageClock >= CYCLE_MS) {
      setStage((state.index + 1) % STAGES.length, true);
    }
  }

  /* ------------------------------------------------------------------ */
  /* stage control                                                        */
  /* ------------------------------------------------------------------ */

  const hudNfeWrap = viz.querySelector(".stepviz__nfe");
  let tickTimer = 0;

  function writeHud(stage) {
    hud.nfe.textContent = String(stage.steps);
    hud.label.textContent = stage.label;
    hud.latency.innerHTML = `${stage.latency}<i>s</i>`;
    hud.total.textContent = stage.total;
    if (!reduceMotion) {
      hudNfeWrap.classList.remove("is-ticking");
      // restart the CSS animation on every stage change
      void hudNfeWrap.offsetWidth;
      hudNfeWrap.classList.add("is-ticking");
      clearTimeout(tickTimer);
      tickTimer = setTimeout(() => hudNfeWrap.classList.remove("is-ticking"), 520);
    }
  }

  function setStage(index, fromAuto) {
    if (index === state.index) {
      // already on this budget: just settle and restart the dwell timer
      state.blend = 1;
      state.prevIndex = index;
      state.stageClock = 0;
      if (!fromAuto) state.holdUntil = performance.now() + HOLD_MS;
      return;
    }
    state.prevIndex = state.index;
    state.index = index;
    state.blend = 0;
    state.surge = 1;
    state.stageClock = 0;
    if (!fromAuto) state.holdUntil = performance.now() + HOLD_MS;

    const stage = STAGES[index];
    writeHud(stage);
    viz.classList.toggle("is-2step", stage.steps === 2);
    tabs.forEach((t) => {
      const on = Number(t.dataset.step) === stage.steps;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (reduceMotion) draw();
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const idx = STAGES.findIndex((s) => s.steps === Number(tab.dataset.step));
      if (idx >= 0) setStage(idx, false);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const idx = (state.index + dir + STAGES.length) % STAGES.length;
      setStage(idx, false);
      tabs[idx].focus();
    });
  });

  /* ------------------------------------------------------------------ */
  /* pointer                                                              */
  /* ------------------------------------------------------------------ */

  let dragging = false;
  let dragStart = null;

  stage.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    cam.steerX = (nx - 0.5) * 2;
    cam.steerY = (ny - 0.5) * 2;
    if (dragging && dragStart) {
      cam.dragYaw = clamp(cam.dragYaw + (e.clientX - dragStart.x) * 0.005, -0.7, 0.7);
      cam.dragPitch = clamp(cam.dragPitch + (e.clientY - dragStart.y) * 0.002, -0.3, 0.3);
      dragStart = { x: e.clientX, y: e.clientY };
    }
  });

  stage.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture?.(e.pointerId);
  });

  function endDrag() {
    dragging = false;
    dragStart = null;
  }
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("pointerleave", () => {
    endDrag();
    cam.steerX = 0;
    cam.steerY = 0;
  });

  /* ------------------------------------------------------------------ */
  /* sizing, theme, lifecycle                                             */
  /* ------------------------------------------------------------------ */

  function resize() {
    const rect = stage.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    cxp = W / 2;
    cyp = H * 0.57;
    focal = Math.min(W * 0.84, H * 2.1);
    cam.dist = W < 640 ? 38.5 : 31;
    gain = clamp(W / 1000, 0.42, 1);
    buildParticles();
    if (!state.running) draw();
  }

  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 80);
  });
  ro.observe(stage);

  const themeObserver = new MutationObserver(() => {
    buildPalette();
    buildSprites();
    if (!state.running) draw();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  function start() {
    if (state.running || reduceMotion) return;
    state.running = true;
    state.last = performance.now();
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) start();
          else stop();
        });
      },
      { threshold: 0.08 }
    );
    io.observe(stage);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  /* ------------------------------------------------------------------ */
  /* init                                                                 */
  /* ------------------------------------------------------------------ */

  buildPalette();
  buildSprites();
  resize();

  // deep link: ?steps=4 pins the animation to one budget
  const requested = Number(new URLSearchParams(window.location.search).get("steps"));
  const startIdx = STAGES.findIndex((s) => s.steps === requested);
  if (startIdx > 0) {
    state.prevIndex = startIdx;
    state.index = startIdx;
    state.blend = 1;
  }

  writeHud(STAGES[state.index]);
  viz.classList.toggle("is-2step", STAGES[state.index].steps === 2);
  tabs.forEach((t) => {
    const on = Number(t.dataset.step) === STAGES[state.index].steps;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (reduceMotion) {
    draw();
  } else {
    start();
  }
})();
