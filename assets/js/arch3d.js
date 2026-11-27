/* ==========================================================================
   StepBridge — "one student, three rails" (3.2 Architecture)

   What the picture has to say, and how:

     input   z_S, z_A ~ N(0, I)  with a shared prompt c
             -> two independent noise clusters at the left end of the rails,
                plus a dashed init link (the 4-step checkpoint seeds the student).

     align 1  trajectory: teacher velocity at *student-visited* states
             -> query beams that start on the student rail and shoot up. The
                teacher rail only lights up where it was actually asked, so
                "answers, never dictates" is visible rather than asserted.

     align 2  distribution: p_theta(x|c) -> p_A(x|c) at sigma = 0
             -> each rail end opens into a cloud of samples; the two clouds are
                linked by *shuffled* pairs (no pointwise correspondence), then
                the student cloud morphs onto the reference cloud.

     output   x_hat = G_theta(z_S, c), 2 NFE
             -> the single lit endpoint of the middle rail, plus the shipped
                rail being the only one that is drawn solid.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("archCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = canvas.parentElement;
  const viz = document.querySelector(".archviz");
  const chips = Array.from(document.querySelectorAll(".chip[data-signal]"));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ------------------------------------------------------------------ */
  /* scene definition                                                     */
  /* ------------------------------------------------------------------ */

  const SPAN = 25;
  const RAILS = [
    { id: "ref", name: "4-step reference", meta: "4 NFE \u00b7 3.78 s", lane: 3.2, depth: 1.5, gates: 5, role: "anchor" },
    { id: "stu", name: "2-step student", meta: "2 NFE \u00b7 1.84 s", lane: 0, depth: 0, gates: 3, role: "student" },
    { id: "tea", name: "50-step teacher", meta: "100 NFE \u00b7 95.0 s", lane: -3.2, depth: -1.5, gates: 51, role: "opd" },
  ];
  const REF = RAILS[0];
  const STU = RAILS[1];
  const TEA = RAILS[2];

  const RGB = {
    ref: [226, 160, 124],
    stu: [143, 127, 221],
    tea: [79, 143, 220],
  };

  /** u in [0,1] runs sigma = 1 -> sigma = 0 */
  function railPoint(rail, u, out) {
    const bow = Math.sin(Math.PI * u);
    const o = out || {};
    o.x = (u - 0.5) * SPAN;
    o.y = rail.lane + bow * 0.62;
    o.z = (rail.depth || 0) + bow * 2.9;
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* projection                                                           */
  /* ------------------------------------------------------------------ */

  let W = 1;
  let H = 1;
  let DPR = 1;
  let focal = 1;
  let cxp = 0;
  let cyp = 0;
  let compact = false;

  const cam = { yaw: -0.4, pitch: 0.2, dist: 34, steerX: 0, steerY: 0 };

  function project(x, y, z) {
    const yy = y + 0.55;
    const cy = Math.cos(cam.yaw);
    const sy = Math.sin(cam.yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;

    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const y1 = yy * cp - z1 * sp;
    const z2 = yy * sp + z1 * cp;

    const d = cam.dist - z2;
    const s = focal / (d > 4 ? d : 4);
    return { x: cxp + x1 * s, y: cyp - y1 * s, s, z: z2 };
  }

  /* ------------------------------------------------------------------ */
  /* sprites                                                              */
  /* ------------------------------------------------------------------ */

  const STOPS = ["#4f8fdc", "#6f86e0", "#8f7fdd", "#b387c9", "#d194ab", "#e2a07c"];
  const N_BUCKETS = 20;
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
      palette.push([0, 1, 2].map((k) => Math.round(lerp(rgb[i0][k], rgb[i0 + 1][k], f))));
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
      grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},0.45)`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, size, size);
      return cv;
    });
  }

  /* ------------------------------------------------------------------ */
  /* sample clouds at sigma = 0                                           */
  /* ------------------------------------------------------------------ */

  const CLOUD_N = 26;
  const SEP = 26; // screenshots read better with a tight cloud

  function lcg(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function makeCloud(seed) {
    const rnd = lcg(seed);
    const pts = [];
    for (let i = 0; i < CLOUD_N; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      // spread in the x/y plane so the cloud faces the camera and reads as a blob
      pts.push({ dx: Math.cos(a) * r, dy: Math.sin(a) * r, dz: (rnd() - 0.5) * 0.35, j: 0.72 + rnd() * 0.55 });
    }
    return pts;
  }

  const CLOUD_REF = makeCloud(20270101);
  const CLOUD_STU = makeCloud(20270202);
  // deliberately NOT identity: distribution matching has no sample correspondence
  const PAIRS = (() => {
    const idx = CLOUD_REF.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(lcg(i + 7)() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  })();

  const REF_R = 0.74;
  const STU_R = 0.62;

  /* ------------------------------------------------------------------ */
  /* state                                                                */
  /* ------------------------------------------------------------------ */

  const CYCLE = 13000;
  const state = {
    signal: "all",
    running: false,
    visible: false,
    t0: 0,
    raf: 0,
    last: 0,
    frozen: null, // ?arch=0.55 freezes the timeline for screenshots
  };

  /* One shared clock. `u` is the denoising progress sigma = 1 -> 0, identical
     for every rail: the whole point is that all three cross the SAME interval in
     the SAME time, and only the number of steps differs. */
  function timeline(now) {
    if (state.frozen !== null) {
      const t = state.frozen;
      return {
        t,
        u: smooth((t - 0.08) / 0.54),
        clouds: smooth((t - 0.66) / 0.16),
        anchor: smooth((t - 0.8) / 0.18),
        fade: 1,
      };
    }
    const t = (((now - state.t0) % CYCLE) + CYCLE) % CYCLE / CYCLE;
    return {
      t,
      u: smooth((t - 0.08) / 0.54),
      clouds: smooth((t - 0.66) / 0.16),
      anchor: smooth((t - 0.8) / 0.18),
      fade: t > 0.96 ? 1 - smooth((t - 0.96) / 0.04) : 1,
    };
  }

  function roleAlpha(rail) {
    if (rail.role === "student") return 1;
    if (state.signal === "all") return 1;
    return state.signal === rail.role ? 1 : 0.16;
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

    // the rails and their sprites already provide the light; a background
    // glow on a wide, short canvas only washes them out
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.82);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const P = {};

  function line(points, color, width, alpha) {
    if (points.length < 2) return;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const q = project(points[i].x, points[i].y, points[i].z);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function railCurve(rail, u0, u1, steps) {
    const pts = [];
    const n = steps || 80;
    for (let i = 0; i <= n; i++) pts.push(railPoint(rail, lerp(u0, u1, i / n), {}));
    return pts;
  }

  function gateRing(rail, u, R, segs) {
    const c = railPoint(rail, u, {});
    const pts = [];
    for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      pts.push({ x: c.x, y: c.y + Math.cos(a) * R, z: c.z + Math.sin(a) * R });
    }
    return pts;
  }

  /* ------------------------------------------------------------------ */
  /* layers                                                              */
  /* ------------------------------------------------------------------ */

  /* A perspective floor under the rails: lines running to the vanishing point
     plus cross lines that compress with distance. It gives the three rails a
     ground plane to sit on, so the panel reads as a 3D scene rather than a
     flat diagram. Everything fades out at the far edge. */
  function drawFloor(tl) {
    const FLOOR_Y = -6.15;
    const Z_FAR = 12.5;
    const Z_NEAR = -12.5;
    const X_HALF = 21;
    const fade = tl.fade === undefined ? 1 : tl.fade;

    ctx.globalCompositeOperation = "lighter";

    // lines parallel to the rails (constant z)
    for (let z = Z_NEAR; z <= Z_FAR; z += 2.5) {
      const depth = 1 - Math.abs(z) / 15; // 1 at the front, 0 far away
      if (depth <= 0.02) continue;
      const a = project(-X_HALF, FLOOR_Y, z);
      const b = project(X_HALF, FLOOR_Y, z);
      ctx.strokeStyle = `rgba(104,150,214,${0.135 * Math.max(0, depth) * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // cross lines (constant x) converging toward the horizon
    for (let x = -X_HALF; x <= X_HALF; x += 3) {
      const pts = [];
      for (let z = Z_NEAR; z <= Z_FAR; z += 1) {
        const q = project(x, FLOOR_Y, z);
        pts.push(q);
      }
      // draw as segments so the alpha can fall off with depth
      let prev = null;
      let prevZ = Z_NEAR;
      pts.forEach((q, i) => {
        const z = Z_NEAR + i;
        if (prev) {
          const depth = 1 - Math.abs((z + prevZ) / 2) / 15;
          if (depth > 0.02) {
            ctx.strokeStyle = `rgba(104,150,214,${0.105 * depth * fade})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        prev = q;
        prevZ = z;
      });
    }

    // a pool of light on the floor, centred under the student rail
    const pool = project(0, FLOOR_Y, 1.5);
    const poolR = clamp(focal * 0.55, 120, W * 0.75);
    const pg = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, poolR);
    pg.addColorStop(0, `rgba(90,132,200,${0.1 * fade})`);
    pg.addColorStop(0.55, `rgba(80,118,180,${0.045 * fade})`);
    pg.addColorStop(1, "rgba(80,118,180,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(pool.x, pool.y, poolR, poolR * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // a faint horizon line where the floor meets the fog
    const h0 = project(-X_HALF, FLOOR_Y, Z_FAR);
    const h1 = project(X_HALF, FLOOR_Y, Z_FAR);
    const g = ctx.createLinearGradient(h0.x, h0.y, h1.x, h1.y);
    g.addColorStop(0, "rgba(120,160,220,0)");
    g.addColorStop(0.5, "rgba(130,170,230,0.2)");
    g.addColorStop(1, "rgba(120,160,220,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(h0.x, h0.y);
    ctx.lineTo(h1.x, h1.y);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
  }

  function drawAxis(tl) {
    // sigma runs along the top edge of the frame: the axis every rail shares
    const y = 4.42;
    const q0 = project(-SPAN / 2, y, 0);
    const q1 = project(SPAN / 2, y, 0);
    ctx.strokeStyle = "rgba(150,175,215,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x, q1.y);
    ctx.stroke();

    // captions are pinned to the canvas corners so they can never be clipped
    text("noise  \u03c3 = 1", 16, H - 14, {
      size: 8.5,
      weight: 600,
      color: "rgba(170,190,220,0.5)",
      spacing: 1.2,
    });
    text("clean  \u03c3 = 0", W - 16, H - 14, {
      size: 8.5,
      weight: 600,
      align: "right",
      color: "rgba(170,190,220,0.5)",
      spacing: 1.2,
    });

    // a single arrow showing the direction of denoising
    const ax = q1.x + 4;
    const ay = q1.y;
    ctx.strokeStyle = "rgba(170,190,220,0.25)";
    ctx.beginPath();
    ctx.moveTo(ax, ay - 5);
    ctx.lineTo(ax + 5, ay);
    ctx.lineTo(ax, ay + 5);
    ctx.stroke();
  }
  function drawRail(rail, tl) {
    const a = roleAlpha(rail);
    if (a <= 0.02) return;
    const rgb = RGB[rail.id];

    // glow + core
    ctx.globalCompositeOperation = "lighter";
    line(railCurve(rail, 0, 1, 70), `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`, 8, 0.05 * a);
    if (rail.id === "stu") {
      // the shipped rail is the spine: draw it solid and colour-coded
      const pts = railCurve(rail, 0, 1, 90);
      for (let i = 0; i < pts.length - 1; i++) {
        const u = i / (pts.length - 1);
        const c = palette[Math.round(u * (N_BUCKETS - 1))];
        const q0 = project(pts[i].x, pts[i].y, pts[i].z);
        const q1 = project(pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.95)`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y);
        ctx.lineTo(q1.x, q1.y);
        ctx.stroke();
      }
    } else {
      line(railCurve(rail, 0, 1, 70), `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`, 1.4, 0.55 * a);
      if (rail.id === "ref") {
        // same clock as the student comet: equal time, fewer steps
        const u = clamp(tl.u, 0, 1);
        if (u > 0.004) {
          const head = railPoint(rail, u, P);
          const hq = project(head.x, head.y, head.z);
          for (let k = 1; k <= 10; k++) {
            const uu = clamp(u - k * 0.009, 0, 1);
            const pp = railPoint(rail, uu, {});
            const qq = project(pp.x, pp.y, pp.z);
            ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.34 * (1 - k / 11) * a})`;
            ctx.lineWidth = 2.2 * (1 - k / 12);
            ctx.beginPath();
            ctx.moveTo(qq.x, qq.y);
            ctx.lineTo(hq.x, hq.y);
            ctx.stroke();
          }
          const rad = clamp(hq.s * 11, 5, 14);
          ctx.globalAlpha = 0.85 * a;
          ctx.drawImage(sprites[N_BUCKETS - 4], hq.x - rad, hq.y - rad, rad * 2, rad * 2);
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawGates(rail, tl) {
    const a = roleAlpha(rail);
    if (a <= 0.02) return;
    const rgb = RGB[rail.id];
    const n = rail.gates;
    ctx.globalCompositeOperation = "lighter";

    if (rail.id === "tea") {
      /* 50-step teacher: small rings, dim by default, lit only inside a window
         the student has already queried */
      const R = 0.17;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        let inWindow = false;
        let hot = false;
        for (const w of WINDOWS) {
          const hw = openWidth(tl, w);
          if (tl.u > w.mid && u >= w.mid - hw && u <= w.mid + hw) inWindow = true;
          if (inWindow && Math.abs(u - w.mid) < hw * 0.5) hot = true;
        }
        const major = i % 10 === 0;
        const alpha = hot ? 0.9 : inWindow ? 0.55 : major ? 0.22 : 0.12;
        const pts = gateRing(rail, u, R, 14);
        if (hot || inWindow) {
          line(pts, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`, 4.5, 0.09 * a);
        }
        line(
          pts,
          `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`,
          hot ? 1.5 : 0.9,
          alpha * a
        );
        if (hot) {
          const c = railPoint(rail, u, P);
          const q = project(c.x, c.y, c.z);
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, clamp(q.s * 3.2, 3, 7));
          g.addColorStop(0, `rgba(190,225,255,${0.75 * a})`);
          g.addColorStop(1, "rgba(120,180,240,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, clamp(q.s * 3.2, 3, 7), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      const R = rail.id === "ref" ? 0.46 : 0.62;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const pts = gateRing(rail, u, R, 40);
        line(pts, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`, 7, 0.05 * a);
        const hot = Math.abs(tl.u - u) < 0.045;
        line(pts, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`, rail.id === "ref" ? 1.2 : 1.8, (hot ? 1 : 0.72) * a);
        if (hot) line(pts, `rgba(255,255,255,1)`, 3.4, 0.28 * a);
        const c = railPoint(rail, u, P);
        const q = project(c.x, c.y, c.z);
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.85 * a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rail.id === "ref" ? 1.6 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawInputs(tl) {
    const show = smooth(tl.t / 0.1) * tl.fade;
    if (show <= 0.02) return;
    const time = performance.now() / 1000;

    [[STU, 0], [REF, 1]].forEach(([rail, k]) => {
      const p = railPoint(rail, 0.005, P);
      const rgb = RGB[rail.id];
      const rnd = lcg(k + 3);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i++) {
        const th = rnd() * Math.PI * 2;
        const rr = 0.28 + rnd() * 0.42;
        const jitter = 0.06 + 0.05 * Math.sin(time * 3 + i * 1.7);
        const x = p.x - 0.55 + Math.cos(th) * (rr + jitter);
        const y = p.y + Math.sin(th) * (rr + jitter);
        const z = p.z + Math.sin(th * 1.3) * 0.4;
        const q = project(x, y, z);
        const size = clamp(q.s * 7, 2, 7);
        ctx.globalAlpha = show * 0.55;
        ctx.drawImage(sprites[rail.id === "ref" ? N_BUCKETS - 3 : 12], q.x - size, q.y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // the reference end is labelled z_A; the student end is covered by "init"
      if (k === 1) {
        const zq = project(p.x - 0.75, p.y + 0.95, p.z);
        text("z", zq.x, zq.y, {
          size: 8.5,
          weight: 700,
          align: "right",
          color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.7 * show})`,
        });
      }
    });

    // init: the 4-step checkpoint IS the student at t = 0 -- drawn as a short
    // arc with an arrowhead, so the direction of the hand-off is unambiguous
    const a = railPoint(REF, 0.005, P);
    const b = railPoint(STU, 0.005, P);
    const flash = reduceMotion ? 1 : 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(time * 2.2));
    const n = 16;
    const arc = [];
    for (let i = 0; i <= n; i++) {
      const tt = i / n;
      // bow the link outward to the left so it does not sit on top of the rails
      const bulge = -Math.sin(tt * Math.PI) * 1.15;
      arc.push(
        project(
          lerp(a.x, b.x, tt) + bulge,
          lerp(a.y, b.y, tt) + Math.sin(tt * Math.PI) * 0.1,
          lerp(a.z, b.z, tt)
        )
      );
    }
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      ctx.strokeStyle = `rgba(226,160,124,${0.62 * show * flash})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(arc[i].x, arc[i].y);
      ctx.lineTo(arc[i + 1].x, arc[i + 1].y);
      ctx.stroke();
    }
    arrowHead(arc[n - 3], arc[n], "rgba(226,160,124,1)", 6, 0.85 * show * flash);
    ctx.globalCompositeOperation = "source-over";

    const mid = arc[Math.floor(n / 2)];
    if (compact) {
      // narrow: centre the tag above the arc so it cannot be clipped
      text("4-step ckpt", mid.x, Math.max(12, mid.y - 12), {
        size: 7,
        weight: 700,
        align: "center",
        color: `rgba(232,170,136,${0.85 * show})`,
        spacing: 0.6,
      });
    } else {
      text("4-step ckpt", mid.x - 8, mid.y + 2, {
        size: 7.5,
        weight: 700,
        align: "right",
        color: `rgba(232,170,136,${0.85 * show})`,
        spacing: 0.8,
      });
    }
  }

    function arrowHead(q0, q1, color, size, alpha) {
    const ang = Math.atan2(q1.y - q0.y, q1.x - q0.x);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(q1.x, q1.y);
    ctx.lineTo(q1.x - Math.cos(ang - 0.42) * size, q1.y - Math.sin(ang - 0.42) * size);
    ctx.lineTo(q1.x - Math.cos(ang + 0.42) * size, q1.y - Math.sin(ang + 0.42) * size);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /* OPD: one supervision window per coarse interval                      */
  /*                                                                      */
  /* The paper's claim is that the target is an INTERVAL mean, not an      */
  /* instantaneous velocity. So the picture has to show:                    */
  /*   · a window [alpha, alpha+w] sitting inside the student's step,      */
  /*   · the secant over that window  ->  the student's interval velocity, */
  /*   · the window widening out of a single point (point -> interval),    */
  /*   · the student handing the window MIDPOINT to the teacher,           */
  /*   · the teacher returning its velocity there, as a separate arrow.    */
  /* ------------------------------------------------------------------ */

  // mid = window centre (in u), hw = half width once fully open.
  // Three windows per coarse step, so the picture reads as a dense set of
  // interval targets rather than one lonely arrow.
  const WINDOWS = [];
  [
    { seg: [0, 0.5], mids: [0.11, 0.25, 0.39], hw: 0.042 },
    { seg: [0.5, 1], mids: [0.6, 0.75, 0.9], hw: 0.046 },
  ].forEach((g) => {
    g.mids.forEach((mid) => WINDOWS.push({ mid, hw: g.hw, seg: g.seg }));
  });

  /** 0 -> point, 1 -> fully open interval; opens after the comet passes */
  function windowOpen(tl, w) {
    return smooth((tl.u - w.mid + 0.06) / 0.1);
  }

  function openWidth(tl, w) {
    return w.hw * windowOpen(tl, w);
  }

  function perpScreen(a, b, len) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    // normal pointing away from the teacher rail (upwards on screen)
    let nx = -dy / l;
    let ny = dx / l;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    return { x: nx * len, y: ny * len };
  }

  /* training-only Pivot path: endpoints pinned, interior bowed. This is what
     makes intermediate states available inside one coarse Euler step. */
  function drawPivot(tl) {
    const focus = state.signal === "anchor" ? 0.12 : 1;
    WINDOWS.forEach((w) => {
      const open = windowOpen(tl, w);
      if (open <= 0.02) return;
      const [s0, s1] = w.seg;
      const n = 26;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const tt = i / n;
        const u = lerp(s0, s1, tt);
        const p = railPoint(STU, u, P);
        // residual that vanishes at both ends of the segment
        const bow = Math.sin(Math.PI * tt) * 0.22 * (1 - tt * 0.2);
        pts.push(project(p.x - bow * 0.55, p.y + bow, p.z));
      }
      ctx.globalCompositeOperation = "lighter";
      let prev = pts[0];
      for (let i = 1; i <= n; i++) {
        ctx.strokeStyle = `rgba(150,160,195,${0.12 * open * focus})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2.5, 3.5]);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        prev = pts[i];
      }
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = "source-over";
    });
  }

  function drawQueries(tl) {
    const focus = state.signal === "anchor" ? 0.05 : 1;
    if (focus < 0.1) return;

    WINDOWS.forEach((w, wi) => {
      const open = windowOpen(tl, w);
      if (open <= 0.02) return;
      const hw = openWidth(tl, w);
      const u0 = w.mid - hw;
      const u1 = w.mid + hw;
      const pMid = railPoint(STU, w.mid, {});
      const qMid = project(pMid.x, pMid.y, pMid.z);

      const pa = railPoint(STU, u0, {});
      const pb = railPoint(STU, u1, {});
      const qa = project(pa.x, pa.y, pa.z);
      const qb = project(pb.x, pb.y, pb.z);

      const c = palette[Math.round(lerp(0.08, 0.45, wi ? 0.7 : 0.2) * (N_BUCKETS - 1))];
      const rank = wi % 3; // three heights keep six neighbours apart
      const emph = rank === 0 ? 1 : rank === 1 ? 0.8 : 0.62;
      const labelled = wi === 0 || wi === 3;

      /* ---- window brackets ---- */
      const lift = perpScreen(qa, qb, 4);
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.55 * open * focus * emph})`;
      ctx.lineWidth = 1;
      [qa, qb].forEach((q) => {
        ctx.beginPath();
        ctx.moveTo(q.x - lift.x * 1.8, q.y - lift.y * 1.8);
        ctx.lineTo(q.x + lift.x * 0.3, q.y + lift.y * 0.3);
        ctx.stroke();
      });

      /* ---- the interval velocity: secant over [u0, u1] ---- */
      if (open > 0.12) {
        const off = perpScreen(qa, qb, [16, 34, 25][rank]);
        const ins = 0.04; // small trim only: the chord should still match the window
        const s0 = {
          x: lerp(qa.x, qb.x, ins) + off.x,
          y: lerp(qa.y, qb.y, ins) + off.y,
        };
        const s1 = {
          x: lerp(qa.x, qb.x, 1 - ins) + off.x,
          y: lerp(qa.y, qb.y, 1 - ins) + off.y,
        };
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.55 + 0.35 * open) * focus * emph})`;
        ctx.lineWidth = 2.8 * Math.min(1, open * 1.6);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.stroke();
        arrowHead(s0, s1, `rgba(${c[0]},${c[1]},${c[2]},1)`, 7, open * focus * emph);
        ctx.globalCompositeOperation = "source-over";

        // the label states both facts: it is a mean, and it spans w
        if (!compact && labelled) {
          const lm = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 - 9 };
          text("mean over w", lm.x, lm.y, {
            size: 6.5,
            weight: 600,
            align: "center",
            color: `rgba(${c[0]},${c[1]},${c[2]},${0.62 * open})`,
            spacing: 0.5,
          });
          if (labelled) {
            const wm = { x: qb.x, y: qb.y + 11 };
            text("w", wm.x, wm.y, {
              size: 7,
              weight: 600,
              align: "center",
              color: `rgba(${c[0]},${c[1]},${c[2]},${0.5 * open})`,
            });
          }
        }
      }

      /* ---- teacher traffic: up first, then back down ---- */
      const ta = railPoint(TEA, w.mid, {});
      const qt = project(ta.x, ta.y, ta.z);

      // ---- up: the student hands the window centre to the teacher ----
      ctx.globalCompositeOperation = "lighter";
      const steps = 12;
      let prev = qMid;
      for (let k = 1; k <= steps; k++) {
        const tt = k / steps;
        const bow = Math.sin(tt * Math.PI);
        const p = project(
          lerp(pMid.x, ta.x, tt) - bow * 0.5,
          lerp(pMid.y, ta.y, tt) + bow * 0.16,
          lerp(pMid.z, ta.z, tt)
        );
        // violet = handed over by the student
        ctx.strokeStyle = `rgba(178,166,236,${0.5 * open * focus * emph})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        prev = p;
      }
      ctx.setLineDash([]);
      // arrowhead at the teacher end: the state really does arrive there
      if (open > 0.3) {
        const t0 = 0.86;
        const t1 = 1;
        const a0 = project(
          lerp(pMid.x, ta.x, t0) - Math.sin(t0 * Math.PI) * 0.5,
          lerp(pMid.y, ta.y, t0) + Math.sin(t0 * Math.PI) * 0.16,
          lerp(pMid.z, ta.z, t0)
        );
        const a1 = project(ta.x, ta.y, ta.z);
        arrowHead(a0, a1, "rgba(178,166,236,1)", 5, 0.85 * open * focus);
      }

      // ---- down: the teacher returns its velocity at that midpoint ----
      const back = smooth((tl.u - w.mid - 0.02) / 0.07);
      if (back > 0.01) {
        let q0 = qt;
        for (let k = 1; k <= steps; k++) {
          const tt = 1 - k / steps;
          const bow = Math.sin(tt * Math.PI);
          const p = project(
            lerp(pMid.x, ta.x, tt) + bow * 0.5,
            lerp(pMid.y, ta.y, tt) + bow * 0.05,
            lerp(pMid.z, ta.z, tt)
          );
          // blue = the teacher's answer
          ctx.strokeStyle = `rgba(79,143,220,${0.75 * back * focus * emph})`;
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          q0 = p;
        }
        const t0 = 0.14;
        const a0 = project(
          lerp(pMid.x, ta.x, t0) + Math.sin(t0 * Math.PI) * 0.5,
          lerp(pMid.y, ta.y, t0) + Math.sin(t0 * Math.PI) * 0.05,
          lerp(pMid.z, ta.z, t0)
        );
        const a1 = project(pMid.x + 0.12, pMid.y + 0.1, pMid.z);
        arrowHead(a0, a1, "rgba(120,170,235,1)", 6.5, 0.9 * back * focus);

        if (!compact && labelled) {
          const lx = qMid.x + 30;
          const ly = (qMid.y + qt.y) / 2 + 6;
          text("v", lx, ly, {
            size: 8.5,
            weight: 700,
            color: `rgba(140,185,240,${0.9 * back})`,
          });
          text("T", lx + 5.5, ly + 2.5, {
            size: 6.5,
            weight: 700,
            color: `rgba(140,185,240,${0.8 * back})`,
          });
        }
      }

      // travelling packets: state up, velocity down
      const up = smooth((tl.u - w.mid + 0.06) / 0.06);
      if (up > 0.01 && up < 1.01) {
        const p = project(
          lerp(pMid.x, ta.x, up),
          lerp(pMid.y, ta.y, up) + Math.sin(up * Math.PI) * 0.22,
          lerp(pMid.z, ta.z, up)
        );
        const r = clamp(p.s * 6, 2.5, 8);
        ctx.globalAlpha = 0.7 * focus;
        ctx.drawImage(sprites[Math.round(lerp(0.2, 0.5, (wi * 0.19) % 1) * (N_BUCKETS - 1))], p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }

      // the matching itself: a quiet link between the two velocities
      if (back > 0.4 && open > 0.5) {
        const fade = smooth((back - 0.4) / 0.4);
        const r = clamp(qMid.s * 9, 4, 12);
        const g = ctx.createRadialGradient(qMid.x, qMid.y, 0, qMid.x, qMid.y, r * 1.8);
        g.addColorStop(0, `rgba(255,240,230,${0.5 * fade * focus})`);
        g.addColorStop(1, "rgba(255,200,170,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(qMid.x, qMid.y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
    });
  }

  function drawPulse(tl) {
    const u = clamp(tl.u, 0, 1) * 0.999;
    if (u <= 0.002) return;
    const p = railPoint(STU, u, P);
    const q = project(p.x, p.y, p.z);

    ctx.globalCompositeOperation = "lighter";
    for (let k = 1; k <= 14; k++) {
      const uu = clamp(u - k * 0.012, 0, 1);
      const pp = railPoint(STU, uu, P);
      const qq = project(pp.x, pp.y, pp.z);
      const c = palette[Math.round(uu * (N_BUCKETS - 1))];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.42 * (1 - k / 14)})`;
      ctx.lineWidth = 3.4 * (1 - k / 16);
      ctx.beginPath();
      ctx.moveTo(qq.x, qq.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
    }

    const rad = clamp(q.s * 22, 9, 26);
    const c = palette[Math.round(u * (N_BUCKETS - 1))];
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0.6)`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  function cloudPoint(rail, base, off, m, radius, out) {
    const o = out || {};
    o.x = base.x + lerp(off.dx, off.rdx, m) * radius * 0.9;
    o.y = base.y + lerp(off.dy, off.rdy, m) * radius;
    o.z = base.z + lerp(off.dz, off.rdz, m) * radius;
    return o;
  }

  function drawClouds(tl) {
    const show = tl.clouds * tl.fade;
    if (show <= 0.02) return;
    const anchorA = state.signal === "opd" ? 0.12 : 1;
    const m = tl.anchor;

    const refBase = railPoint(REF, 1, {});
    const stuBase = railPoint(STU, 1, {});

    // shuffled pair lines: distribution matching, not sample matching
    if (m < 0.98 && anchorA > 0.3) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < CLOUD_N; i++) {
        const r = CLOUD_REF[i];
        const s = CLOUD_STU[i];
        const sOff = {
          dx: s.dx,
          dy: s.dy,
          dz: s.dz,
          rdx: CLOUD_REF[PAIRS[i]].dx,
          rdy: CLOUD_REF[PAIRS[i]].dy,
          rdz: CLOUD_REF[PAIRS[i]].dz,
        };
        const a = project(refBase.x + r.dx * REF_R * 0.9, refBase.y + r.dy * REF_R, refBase.z + r.dz * REF_R);
        const sp = cloudPoint(STU, stuBase, sOff, m, STU_R, {});
        const b = project(sp.x, sp.y, sp.z);
        ctx.strokeStyle = `rgba(255,206,178,${0.13 * show * (1 - m) * anchorA})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // sample dots
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < CLOUD_N; i++) {
      const s = CLOUD_STU[i];
      const sOff = {
        dx: s.dx,
        dy: s.dy,
        dz: s.dz,
        rdx: CLOUD_REF[PAIRS[i]].dx,
        rdy: CLOUD_REF[PAIRS[i]].dy,
        rdz: CLOUD_REF[PAIRS[i]].dz,
      };
      const sp = cloudPoint(STU, stuBase, sOff, m, STU_R, {});
      const q = project(sp.x, sp.y, sp.z);
      const size = clamp(3.1 * s.j, 1.5, 4.4);
      ctx.globalAlpha = show * 0.9;
      ctx.drawImage(sprites[11], q.x - size, q.y - size, size * 2, size * 2);
    }
    for (let i = 0; i < CLOUD_N; i++) {
      const r = CLOUD_REF[i];
      const p = { x: refBase.x + r.dx * REF_R * 0.9, y: refBase.y + r.dy * REF_R, z: refBase.z + r.dz * REF_R };
      const q = project(p.x, p.y, p.z);
      const size = clamp(3.1 * r.j, 1.5, 4.4);
      ctx.globalAlpha = show * 0.9 * (state.signal === "opd" ? 0.25 : 1);
      ctx.drawImage(sprites[N_BUCKETS - 3], q.x - size, q.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // the two distributions, labelled
    if (!compact) {
      const la = project(refBase.x + 0.05, refBase.y + 1.0, refBase.z);
      text("p", la.x, la.y, { size: 10, weight: 600, color: `rgba(240,190,160,${0.85 * show})` });
      text("A", la.x + 5, la.y + 3, { size: 7.5, weight: 700, color: `rgba(240,190,160,${0.7 * show})` });
      const lb = project(stuBase.x + 0.05, stuBase.y - 1.05, stuBase.z);
      text("p", lb.x, lb.y, { size: 10, weight: 600, color: `rgba(178,166,236,${0.9 * show})` });
      text("\u03b8", lb.x + 5, lb.y + 3, { size: 7.5, weight: 700, color: `rgba(178,166,236,${0.8 * show})` });
    }
  }

  function drawAnchor(tl) {
    const a = (state.signal === "opd" ? 0.08 : 1) * tl.anchor * tl.fade;
    if (a <= 0.02) return;

    const refBase = railPoint(REF, 1, {});
    const stuBase = railPoint(STU, 1, {});

    ctx.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const dz = (k - 1) * 0.16;
      const steps = 12;
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const tt = i / steps;
        const p = project(
          lerp(refBase.x, stuBase.x, tt),
          lerp(refBase.y, stuBase.y, tt) - Math.sin(tt * Math.PI) * 0.5,
          lerp(refBase.z, stuBase.z, tt) + dz
        );
        if (prev) {
          ctx.strokeStyle = `rgba(255,190,150,${(k === 1 ? 0.7 : 0.3) * a})`;
          ctx.lineWidth = k === 1 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        prev = p;
      }
    }

    // arrowheads: the anchor pulls the student endpoint up toward the reference
    const tip = project(stuBase.x, stuBase.y + 0.55, stuBase.z);
    ctx.strokeStyle = `rgba(255,196,160,${0.8 * a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tip.x - 5, tip.y + 5);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(tip.x + 5, tip.y + 5);
    ctx.stroke();

    // travelling pulse down the anchor
    const ph = ((performance.now() / 1000) * 0.5) % 1;
    const px = lerp(refBase.x, stuBase.x, ph);
    const py = lerp(refBase.y, stuBase.y, ph) - Math.sin(ph * Math.PI) * 0.5;
    const pz = lerp(refBase.z, stuBase.z, ph);
    const q = project(px, py, pz);
    const rad = clamp(q.s * 14, 6, 18);
    ctx.globalAlpha = 0.7 * a;
    ctx.drawImage(sprites[N_BUCKETS - 3], q.x - rad, q.y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (!compact) {
      const mid = project(refBase.x - 0.35, (refBase.y + stuBase.y) / 2 - 0.55, refBase.z);
      text("ANCHOR", mid.x, mid.y, {
        size: 8.5,
        weight: 700,
        align: "right",
        color: `rgba(255,206,176,${0.9 * a})`,
        spacing: 1.3,
      });
      text("DMD", mid.x, mid.y + 10, {
        size: 7.5,
        weight: 600,
        align: "right",
        color: `rgba(255,206,176,${0.55 * a})`,
        spacing: 1.3,
      });
    }

    // "matched" flash as the clouds coalesce
    if (tl.anchor > 0.82 && tl.anchor < 0.995 && state.signal !== "opd") {
      const f = (tl.anchor - 0.82) / 0.175;
      text("matched", W * 0.5, H - 30, {
        size: 9,
        weight: 700,
        align: "center",
        color: `rgba(255,222,200,${(1 - f) * 0.9})`,
        spacing: 2.4,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* text                                                                 */
  /* ------------------------------------------------------------------ */

  const TEXT = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";

  function text(str, sx, sy, opts) {
    const o = opts || {};
    const q = { x: sx, y: sy };
    ctx.font = `${o.weight || 600} ${o.size || 10}px ${TEXT}`;
    ctx.fillStyle = o.color || "rgba(230,238,250,0.85)";
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = (o.spacing || 0) + "px";
    ctx.fillText(str, q.x, q.y);
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  }

  function drawLabels(tl) {
    RAILS.forEach((rail) => {
      const a = roleAlpha(rail);
      if (a < 0.25) return;
      const rgb = RGB[rail.id];
      const p0 = railPoint(rail, 0, {});
      const q = project(p0.x, p0.y, p0.z);

      if (compact) {
        // phones: the legend under the canvas already names the rails, so just
        // mark each rail head with its colour instead of crowding the frame
        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.9 * a})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 3, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // desktop: a clean label column in the left gutter, dot on the rail head
      const gx = 22;
      text(rail.name, gx + 12, q.y - 7, {
        size: 10.5,
        weight: 600,
        color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.95})`,
      });
      text(rail.meta, gx + 12, q.y + 7, {
        size: 8.5,
        weight: 500,
        color: "rgba(200,212,232,0.5)",
        spacing: 0.3,
      });

      // short leader only: a long one would read as part of the rail
      const lx = Math.min(q.x - 8, gx + 40);
      ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.45 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx + 4, q.y);
      ctx.lineTo(lx, q.y);
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.9 * a})`;
      ctx.beginPath();
      ctx.arc(gx, q.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // "2 steps": one badge per student transition
    if (!compact && roleAlpha(STU) > 0.5) {
      for (let i = 0; i < 2; i++) {
        const u = (i + 0.5) / 2;
        const p = railPoint(STU, u, P);
        const q = project(p.x, p.y - 0.95, p.z);
        ctx.fillStyle = "rgba(9,14,26,0.82)";
        ctx.beginPath();
        ctx.arc(q.x, q.y, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(166,152,238,0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
        text(String(i + 1), q.x, q.y + 0.5, {
          size: 9,
          weight: 600,
          align: "center",
          color: "rgba(228,222,255,0.95)",
        });
      }
    }

    // output tag on the shipped rail
    const p1 = railPoint(STU, 1, {});
    const out = project(p1.x + (compact ? 0.55 : 1.25), p1.y - (compact ? 1.75 : 1.5), p1.z);
    text("x\u0302", out.x, out.y, {
      size: 11,
      weight: 600,
      color: `rgba(205,196,248,${0.9 * tl.fade})`,
    });
    if (!compact) {
      text("2 NFE", out.x, out.y + 11, {
        size: 7.5,
        weight: 600,
        color: `rgba(205,196,248,${0.55 * tl.fade})`,
        spacing: 0.8,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* frame                                                                */
  /* ------------------------------------------------------------------ */

  function draw(now) {
    const tl = timeline(now);

    // derive the scale from the live backing store: a stale DPR would zoom the
    // whole scene into the corner
    const scale = canvas.width / W || 1;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    drawBackground();

    drawFloor(tl);
    drawAxis(tl);
    drawRail(TEA, tl);
    drawRail(REF, tl);
    drawRail(STU, tl);

    drawInputs(tl);
    drawQueries(tl);
    drawGates(TEA, tl);
    drawGates(REF, tl);
    drawGates(STU, tl);
    drawPulse(tl);
    drawClouds(tl);
    drawAnchor(tl);
    drawLabels(tl);

    drawVignette();
  }

  /* ------------------------------------------------------------------ */
  /* loop                                                                 */
  /* ------------------------------------------------------------------ */

  function tick(now) {
    if (!state.running) return;
    draw(now);
    state.raf = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.last = performance.now();
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
  }

  /* ------------------------------------------------------------------ */
  /* sizing / interaction                                                 */
  /* ------------------------------------------------------------------ */

  /* The page is laid out with CSS `zoom` (see --ui-zoom in style.css). A rect
     measured inside a zoomed subtree is already in zoomed CSS pixels, but
     devicePixelRatio does not account for CSS zoom, so using it directly would
     under-sample the canvas and make the figure soft. Dividing by the zoom
     restores one backing pixel per rendered pixel. */
  function uiZoom() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-zoom");
    const z = parseFloat(raw);
    return z > 0.1 ? z : 1;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    W = Math.max(1, rect.width);
    H = Math.max(1, rect.height);
    DPR = Math.min(2, (window.devicePixelRatio || 1) / uiZoom());
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    compact = W < 640;
    const span = compact ? 17 : 25;
    cam.dist = compact ? 42 : 36;
    const frac = compact ? 0.64 : 0.7;
    const s = (frac * W) / span;
    focal = s * cam.dist;

    cxp = compact ? W * 0.5 : W * 0.468;
    cyp = compact ? H * 0.55 : H * 0.53;

    if (!state.running) draw(performance.now());
  }

  let resizeTimer = 0;
  if ("ResizeObserver" in window) {
    new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 80);
    }).observe(stage);
  }

  stage.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    cam.steerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
    cam.steerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  stage.addEventListener("pointerleave", () => {
    cam.steerX = 0;
    cam.steerY = 0;
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      state.signal = chip.dataset.signal;
      if (!state.running) draw(performance.now());
    });
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          state.visible = entry.isIntersecting;
          if (entry.isIntersecting) {
            if (!state.t0) state.t0 = performance.now();
            start();
          } else {
            stop();
          }
        });
      },
      { threshold: 0.06 }
    ).observe(stage);
  } else {
    state.visible = true;
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (state.visible) start();
  });

  /* ------------------------------------------------------------------ */
  /* init                                                                 */
  /* ------------------------------------------------------------------ */

  const frozen = new URLSearchParams(window.location.search).get("arch");
  if (frozen !== null && !isNaN(Number(frozen))) state.frozen = clamp(Number(frozen), 0, 1);

  buildPalette();
  buildSprites();
  resize();

  // Frozen mode still renders every frame: the timeline is pinned, but the
  // canvas must keep redrawing so late layout (fonts, sticky scroll) cannot
  // leave a half-sized frame on screen.
  state.t0 = performance.now();
  if (reduceMotion) {
    draw(performance.now());
    // a couple of delayed repaints for late layout
    setTimeout(() => draw(performance.now()), 120);
    setTimeout(() => draw(performance.now()), 500);
  } else {
    start();
  }
})();
