/* ==========================================================================
   StepBridge — comparison wall (hero)
   Six clip pairs play at once, 3 x 2. Each cell is a baked side-by-side video:
   base two-step on the left, StepBridge on the right. The wall advances one
   set at a time; the caption keeps chrome to a minimum because this sits in
   the hero, right under the title.
   ========================================================================== */
(function () {
  "use strict";

  const root = document.getElementById("cinema");
  const dataEl = document.getElementById("videoData");
  if (!root || !dataEl) return;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Cache-buster for the media files. The clips were re-encoded in place
     (the baked title row was cropped off), but the file names did not change,
     so browsers happily served the old bytes -- which is why a few tiles kept
     showing the burned-in "Original / + StepBridge" text. Bump V when the
     files change again. */
  const V = "2";
  const bust = (url) => (url ? url + (url.includes("?") ? "&" : "?") + "v=" + V : url);
  const ALL = JSON.parse(dataEl.textContent);

  const SLOTS = 6; // 3 columns x 2 rows on desktop
  const DWELL = 7800;

  // phones get two at a time: six stacked clips would push the abstract far down
  function perSet() {
    return window.innerWidth <= 700 ? 2 : SLOTS;
  }

  const wall = document.getElementById("cinemaWall");
  const dots = document.getElementById("cinemaDots");
  const pageEl = document.getElementById("cinemaPage");
  const progressEl = document.getElementById("cinemaProgress");
  const playBtn = document.getElementById("cinemaPlay");
  const prevBtn = document.getElementById("prevSet");
  const nextBtn = document.getElementById("nextSet");
  const hint = document.getElementById("cinemaHint");

  const state = {
    list: ALL,
    set: 0,
    playing: true,
    hover: false,
    visible: false,
    raf: 0,
    last: 0,
    elapsed: 0,
    tiles: [],
  };

  function setCount() {
    return Math.max(1, Math.ceil(state.list.length / perSet()));
  }

  function itemAt(setIndex, slot) {
    const n = state.list.length;
    if (!n) return null;
    const i = setIndex * perSet() + slot;
    // the last set is topped up from the front of the list, so the wall is
    // always full (15 clips / 6 per set would otherwise leave three holes)
    return state.list[i % n];
  }

  /* ------------------------------------------------------------------ */
  /* wall                                                                */
  /* ------------------------------------------------------------------ */

  function buildWall() {
    wall.innerHTML = "";
    state.tiles = [];

    for (let slot = 0; slot < SLOTS; slot++) {
      const fig = document.createElement("figure");
      fig.className = "tile";
      fig.innerHTML =
        '<div class="tile__legend"><span>Original</span><span>+ StepBridge</span></div>' +
        '<div class="tile__frame">' +
        '<img class="tile__poster" alt="" aria-hidden="true">' +
        '<video class="tile__video" muted loop playsinline preload="none" ' +
        'aria-label="Side-by-side comparison: baseline on the left, StepBridge on the right"></video>' +
        '<span class="tile__split" aria-hidden="true"></span>' +
        '<button class="tile__expand" type="button" aria-label="Open this comparison full size">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/></svg></button>' +
        "</div>" +
        '<figcaption class="tile__meta">' +
        '<span class="tile__title"></span>' +
        '<span class="tile__tags"></span>' +
        "</figcaption>";

      const tile = {
        el: fig,
        frame: fig.querySelector(".tile__frame"),
        video: fig.querySelector(".tile__video"),
        poster: fig.querySelector(".tile__poster"),
        title: fig.querySelector(".tile__title"),
        tags: fig.querySelector(".tile__tags"),
        item: null,
        src: "",
      };

      const open = () => {
        if (!tile.item || typeof window.SBopenVideo !== "function") return;
        window.SBopenVideo(
          bust(tile.item.video),
          tile.item.title,
          tile.item.model + " \u00b7 " + tile.item.method + " two-step"
        );
      };
      fig.querySelector(".tile__expand").addEventListener("click", (e) => {
        e.stopPropagation();
        open();
      });
      tile.video.addEventListener("click", open);

      wall.appendChild(fig);
      state.tiles.push(tile);
    }
  }

  function paintTile(tile, item, ordinal) {
    tile.item = item;
    tile.poster.src = bust(item.poster);
    tile.frame.classList.remove("is-live");
    tile.title.textContent = item.title;
    tile.frame.dataset.index = String(ordinal + 1).padStart(2, "0");
    tile.tags.innerHTML =
      '<span class="tag tag--model">' + item.model + "</span>" +
      '<span class="tag tag--method">' + item.method + "</span>";

    const videoUrl = bust(item.video);
    if (tile.src !== videoUrl) {
      tile.src = videoUrl;
      tile.video.src = videoUrl;
      tile.video.load();
    }
    if (state.playing && state.visible) tile.video.play().catch(() => {});
  }

  function paintSet() {
    state.tiles.forEach((tile, slot) => {
      const item = slot < perSet() ? itemAt(state.set, slot) : null;
      if (!item) {
        tile.el.classList.add("is-empty");
        tile.video.pause();
        return;
      }
      tile.el.classList.remove("is-empty");
      paintTile(tile, item, (state.set * perSet() + slot) % state.list.length);
    });

    pageEl.textContent =
      "set " + String(state.set + 1).padStart(2, "0") + " / " + String(setCount()).padStart(2, "0");
    renderDots();
    state.elapsed = 0;
    progressEl.style.transform = "scaleX(0)";
  }

  function renderDots() {
    const n = setCount();
    if (dots.children.length !== n) {
      dots.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "cinema__dot";
        b.setAttribute("aria-label", "Go to comparison set " + (i + 1));
        b.addEventListener("click", () => goTo(i));
        dots.appendChild(b);
      }
    }
    Array.from(dots.children).forEach((d, i) => {
      d.classList.toggle("is-active", i === state.set);
    });
  }

  function goTo(i) {
    const n = setCount();
    state.set = ((i % n) + n) % n;
    pauseAll();
    paintSet();
    resumeAll();
  }

  /* ------------------------------------------------------------------ */
  /* playback                                                            */
  /* ------------------------------------------------------------------ */

  function playAll() {
    if (!state.visible) return;
    state.tiles.forEach((t) => {
      if (t.src && !t.el.classList.contains("is-empty")) t.video.play().catch(() => {});
    });
  }

  function pauseAll() {
    state.tiles.forEach((t) => t.video.pause());
  }

  function resumeAll() {
    if (state.playing) playAll();
  }

  function setPlaying(on) {
    state.playing = on;
    root.classList.toggle("is-paused", !on);
    playBtn.setAttribute("aria-label", on ? "Pause playback" : "Start playback");
    playBtn.setAttribute("title", on ? "Pause playback" : "Start playback");
    if (on) playAll();
    else pauseAll();
  }

  playBtn.addEventListener("click", () => setPlaying(!state.playing));
  prevBtn.addEventListener("click", () => goTo(state.set - 1));
  nextBtn.addEventListener("click", () => goTo(state.set + 1));

  root.addEventListener("mouseenter", () => {
    state.hover = true;
  });
  root.addEventListener("mouseleave", () => {
    state.hover = false;
    state.elapsed = 0;
  });

  root.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    goTo(state.set + (e.key === "ArrowRight" ? 1 : -1));
  });

  /* ------------------------------------------------------------------ */
  /* ticker                                                              */
  /* ------------------------------------------------------------------ */

  function loop(now) {
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0.016;
    state.last = now;

    const stalled = !state.playing || state.hover || !state.visible || reduceMotion;
    if (!stalled) {
      state.elapsed += dt * 1000;
      if (state.elapsed >= DWELL) goTo(state.set + 1);
    }
    progressEl.style.transform = "scaleX(" + clamp(state.elapsed / DWELL, 0, 1) + ")";

    state.raf = requestAnimationFrame(loop);
  }

  function start() {
    if (state.raf) return;
    state.last = 0;
    state.raf = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  /* ------------------------------------------------------------------ */
  /* visibility / init                                                   */
  /* ------------------------------------------------------------------ */

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          state.visible = entry.isIntersecting;
          if (entry.isIntersecting) {
            state.elapsed = 0;
            resumeAll();
            start();
          } else {
            pauseAll();
            stop();
          }
        });
      },
      { threshold: 0.1 }
    ).observe(root);
  } else {
    state.visible = true;
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAll();
      stop();
    } else if (state.visible) {
      resumeAll();
      start();
    }
  });

  if (reduceMotion) {
    state.playing = false;
    root.classList.add("is-paused");
    if (hint) hint.textContent = "Auto-advance off (reduced motion)";
  }

  let resizeTimer = 0;
  let lastPer = perSet();
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = perSet();
      if (next === lastPer) return;
      lastPer = next;
      state.set = 0;
      pauseAll();
      paintSet();
      resumeAll();
    }, 180);
  });

  buildWall();
  paintSet();
})();
