/* ==========================================================================
   StepBridge project page — interactions
   Vanilla JS, no build step.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------ theme ------------------------------ */
  const root = document.documentElement;
  const themeBtn = $("#themeToggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#0a0f1c" : "#faf8f4");
    if (themeBtn) {
      themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
      themeBtn.setAttribute("title", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    try { localStorage.setItem("sb-theme", theme); } catch (e) {}
  }

  // Allow ?theme=dark|light for sharing / screenshots.
  const urlTheme = new URLSearchParams(window.location.search).get("theme");
  if (urlTheme === "dark" || urlTheme === "light") applyTheme(urlTheme);

  themeBtn?.addEventListener("click", () => {
    applyTheme(root.dataset.theme === "dark" ? "light" : "dark");
  });

  /* ------------------------------ header ----------------------------- */
  const header = $("#header");
  const toTop = $("#toTop");

  function onScroll() {
    const y = window.scrollY;
    header?.classList.toggle("is-scrolled", y > 12);
    if (toTop) {
      const show = y > 900;
      toTop.style.opacity = show ? "1" : "0";
      toTop.style.pointerEvents = show ? "auto" : "none";
      toTop.style.transform = show ? "none" : "translateY(8px)";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  toTop?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  /* --------------------------- mobile nav ---------------------------- */
  const navToggle = $("#navToggle");
  const navDrawer = $("#navDrawer");

  function closeDrawer() {
    navDrawer?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }

  navToggle?.addEventListener("click", () => {
    const open = navDrawer?.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  $$("a", navDrawer).forEach((a) => a.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  /* --------------------------- active nav ---------------------------- */
  const navLinks = $$(".nav__links a");
  const sectionIds = ["videos", "method", "abstract", "results", "analysis", "citation"];
  const sectionEls = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);

  if ("IntersectionObserver" in window && sectionEls.length) {
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sectionEls.forEach((el) => navObserver.observe(el));
  }

  /* ----------------------------- reveal ------------------------------ */
  const revealEls = $$(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    revealEls.forEach((el) => {
      const group = el.parentElement;
      if (group) {
        const siblings = $$(":scope > .reveal", group);
        if (siblings.length > 1) {
          el.style.transitionDelay = Math.min(siblings.indexOf(el), 5) * 70 + "ms";
        }
      }
      revealObserver.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* -------------------------- table filter --------------------------- */
  const table = $("#mainTable");
  if (table) {
    const rows = $$("tbody tr", table);
    const chips = $$(".chip[data-filter]");

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        const filter = chip.dataset.filter;
        rows.forEach((row) => {
          const show = filter === "all" || row.dataset.group === filter;
          row.classList.toggle("hide", !show);
        });
      });
    });
  }

  /* --------------------- benchmark table tabs ------------------------ */
  const tableTabs = $$(".table-tab");
  const tablePanels = $$(".table-panel");
  if (tableTabs.length) {
    const chipRow = $('[data-chips="core"]');
    tableTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.table;
        tableTabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        tablePanels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === key));
        if (chipRow) chipRow.hidden = key !== "core";
      });
    });
  }

  /* ------------------------ image lightbox --------------------------- */
  const dialog = $("#lightbox");  const lbTitle = $("#lbTitle");
  const lbSub = $("#lbSub");
  const lbMedia = $("#lbMedia");
  const lbCaption = $("#lbCaption");
  let lastFocus = null;

  function openDialog() {
    if (!dialog) return;
    lastFocus = document.activeElement;
    document.body.classList.add("no-scroll");
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    $("#lbClose")?.focus();
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("no-scroll");
    // stop and release any playing media
    $$("video", lbMedia).forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    lbMedia.innerHTML = "";
    lastFocus?.focus?.();
  }

  function openImage(src, title, sub, caption) {
    lbTitle.textContent = title || "Figure";
    lbSub.textContent = sub || "Click outside or press Esc to close";
    lbCaption.textContent = caption || "";
    lbMedia.innerHTML = "";
    const img = new Image();
    img.src = src;
    img.alt = title || "Paper figure";
    lbMedia.appendChild(img);
    openDialog();
  }

  function openVideo(src, title, sub, caption) {
    lbTitle.textContent = title || "Video";
    lbSub.textContent = sub || "";
    lbCaption.textContent = caption || "Left: baseline two-step student. Right: the same student with StepBridge.";
    lbMedia.innerHTML = "";
    const v = document.createElement("video");
    v.src = src;
    v.controls = true;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    lbMedia.appendChild(v);
    v.play().catch(() => {});
    openDialog();
  }

  $("#lbClose")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog();
  });
  dialog?.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeDialog();
  });
  dialog?.addEventListener("close", () => {
    document.body.classList.remove("no-scroll");
    $$("video", lbMedia).forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    lbMedia.innerHTML = "";
  });

  /* zoomable figures */
  $$("[data-zoom]").forEach((el) => {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    const caption = el.dataset.caption || "";
    const title = el.closest("figure")?.querySelector("figcaption b")?.textContent || "Figure";
    const open = () => openImage(el.dataset.zoom, title, "Paper figure", caption);
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });

  /* expose the video lightbox for the cinema carousel */
  window.SBopenVideo = openVideo;

  /* ------------------ abstract ⇄ flowchart cross-links --------------- */
  const refMarks = $$(".ref-mark");
  if (refMarks.length) {
    const stages = $$(".flow__stage[data-stage]");
    const lit = (ref, on) => {
      stages.forEach((s) => {
        if (s.dataset.stage === ref) s.classList.toggle("is-lit", on);
      });
      refMarks.forEach((m) => {
        if (m.dataset.ref === ref) m.classList.toggle("is-active", on);
      });
    };
    refMarks.forEach((mark) => {
      const ref = mark.dataset.ref;
      mark.setAttribute("role", "button");
      mark.setAttribute("tabindex", "0");
      mark.addEventListener("mouseenter", () => lit(ref, true));
      mark.addEventListener("mouseleave", () => lit(ref, false));
      mark.addEventListener("focus", () => lit(ref, true));
      mark.addEventListener("blur", () => lit(ref, false));
      const jump = () => {
        const target = stages.find((s) => s.dataset.stage === ref);
        if (!target) return;
        const chart = $(".flowchart");
        // On stacked layouts the chart can be far below; bring it into view.
        if (chart && chart.getBoundingClientRect().top > window.innerHeight * 0.9) {
          chart.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        }
        lit(ref, true);
        setTimeout(() => lit(ref, false), 1600);
      };
      mark.addEventListener("click", jump);
      mark.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          jump();
        }
      });
    });
  }

  /* ----------------------------- copy bib ---------------------------- */
  const copyBtn = $("#copyBib");
  const toast = $("#toast");
  const toastText = $("#toastText");
  let toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toastText.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  copyBtn?.addEventListener("click", async () => {
    const text = $("#bibtex")?.innerText?.trim() || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for file:// or restricted contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
    }
    const label = copyBtn.querySelector("span");
    if (label) {
      label.textContent = "Copied";
      setTimeout(() => (label.textContent = "Copy"), 1800);
    }
    showToast("BibTeX copied to clipboard");
  });

})();
