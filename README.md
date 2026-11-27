<div align="center">
  <img src="docs/logo.svg" width="72" height="72" alt="StepBridge">
  <h1>StepBridge · Project Page</h1>
  <p><b>Unifying Trajectory and Distribution Supervision<br>for Efficient Two-Step Diffusion Generation</b></p>
  <p>
    <a href="https://visualgenmi.github.io/StepBridge-Page/"><img src="https://img.shields.io/badge/LIVE-Project%20Page-2f7d4f?style=for-the-badge&labelColor=0a0f1c&logo=githubpages&logoColor=white" alt="Live site"></a>
    <a href="https://github.com/VisualGenMi/StepBridge"><img src="https://img.shields.io/badge/CODE-Repository-181717?style=for-the-badge&labelColor=0a0f1c&logo=github&logoColor=white" alt="Code"></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/build-none%20required-2b6cb0?style=flat-square" alt="No build step">
    <img src="https://img.shields.io/badge/stack-vanilla%20JS%20·%20Canvas%202D-c98a3f?style=flat-square" alt="Vanilla JS">
    <img src="https://img.shields.io/badge/dependencies-0-4a4a8f?style=flat-square" alt="Zero dependencies">
    <img src="https://img.shields.io/badge/QA-38%20checks%20passing-2f7d4f?style=flat-square" alt="QA">
    <img src="https://img.shields.io/badge/license-figures%20©%20authors-9aa4b8?style=flat-square" alt="License">
  </p>
  <p><i>A single-page, dependency-free project site — open <code>index.html</code> and it runs.<br>No framework, no bundler, no server-side code.</i></p>
</div>

<br>

<p align="center">
  <img src="docs/hero.webp" width="100%" alt="StepBridge project page, hero section">
</p>

---

## Table of contents

- **Getting started** — [What this is](#what-this-is) · [Quick start](#quick-start) · [Deep links](#deep-links-for-screenshots)
- **Ship it** — [Deployment](#deployment) · [Adding collaborators](#adding-collaborators)
- **Work on it** — [Repository layout](#repository-layout) · [What to edit](#what-to-edit) · [Rebuilding assets](#rebuilding-assets)
- **Understand it** — [Design notes](#design-notes) · [Automated checks](#automated-checks) · [Credits](#credits)

---

## What this is

A project page for a paper on two-step video diffusion. It is one static HTML
file plus hand-written CSS and JavaScript, with two custom 3D figures drawn
directly into `<canvas>` and a fifteen-clip comparison wall in the hero.

<table width="100%">
<tr>
<td width="33%" valign="top">

### 🎬 Video wall
Six side-by-side comparisons at once, uncropped, auto-advancing in three sets.

</td>
<td width="33%" valign="top">

### 🌐 3D figures
A step-compression corridor and a three-rail distillation diagram, both in
Canvas 2D — no WebGL, no three.js.

</td>
<td width="33%" valign="top">

### ⚡ Zero tooling
No `npm install`, no build step, no framework. Edit the file, refresh.

</td>
</tr>
</table>

<table width="100%">
<tr>
<td width="50%">

| | |
| --- | --- |
| **Live site** | <https://visualgenmi.github.io/StepBridge-Page/> |
| **Code** | <https://github.com/VisualGenMi/StepBridge> |
| **Payload** | ~50 MB video, < 600 KB everything else |
| **Hosting** | GitHub Pages, `main` branch root |

</td>
<td width="50%">

> **Paper.** Not published here yet. The only PDF in hand is the anonymous
> review version, which carries a *confidential* header on every page, so it is
> deliberately kept out of this repository (see `.gitignore`).
> The hero button reads **Paper · Soon** until a public version exists.

</td>
</tr>
</table>

---

## Quick start

```powershell
cd StepBridge-Page
python -m http.server 8899 --bind 127.0.0.1
# → http://127.0.0.1:8899/
```

On Windows, `serve.cmd` does the same thing in one double-click.

> Opening `index.html` directly from disk mostly works, but the JSON playlist and
> video range requests behave better over `http://`.

### Deep links for screenshots

The page accepts URL parameters so that a specific frame can be reproduced and
shared — useful when sending a figure to a co-author.

| Parameter | Effect |
| --- | --- |
| `?theme=light` | Force the light theme for this visit |
| `?steps=2` | Pin the step-compression corridor on the two-step stage |
| `?arch=0.55` | Freeze the architecture timeline at 55 % (any value in `0`–`1`) |

Example: <https://visualgenmi.github.io/StepBridge-Page/?arch=0.62&theme=dark>

---

## Deployment

Served by **GitHub Pages** from the `main` branch, repository root.

```powershell
git add -A
git commit -m "update: what changed"
git push
```

Pages rebuilds automatically; the new version is live in about a minute.

<details>
<summary><b>First-time setup</b> (already done for this repository)</summary>

<br>

1. Create the repository under the organisation.
2. `git remote add origin https://github.com/VisualGenMi/StepBridge-Page.git`
3. `git push -u origin main`
4. **Settings → Pages** → Source `Deploy from a branch` → Branch `main`, folder `/ (root)`.

The free organisation plan only serves Pages from **public** repositories, which
is why this repository is public while the code repository stays separate.
`.nojekyll` sits in the root so Jekyll does not reinterpret `assets/`.

</details>

### Adding collaborators

Organisation → **People → Invite member** — role *Member* to push, *Owner* to
change settings. Every repository in the organisation inherits the access, which
is simpler than adding collaborators one repository at a time.

### Alternatives

| Option | How |
| --- | --- |
| No Git client | Upload `index.html` + `assets/` via **Add file → Upload files** |
| Drag and drop | Drop the folder on <https://app.netlify.com/drop> |
| Custom domain | Pages → Custom domain, plus a `CNAME` file in the root |

---

## Repository layout

```
StepBridge-Page/
├── index.html                 # the whole page: hero, 7 sections, JSON playlist
├── serve.cmd                  # one-click local server on Windows
├── .nojekyll                  # keep Jekyll out of assets/
├── docs/                      # screenshots used by this README
├── assets/
│   ├── css/style.css          # base layout, hero, 3D containers, authors, role cards
│   ├── css/cinema.css         # the comparison wall
│   ├── css/results.css        # gap-recovery bars + switchable tables
│   ├── css/flow.css           # abstract reading-guide flowchart
│   ├── css/hero.css           # emblem, wordmark, tagline
│   ├── js/main.js             # theme, nav state, table filter, lightbox, BibTeX copy
│   ├── js/steps3d.js          # 3D step compression (Canvas 2D)
│   ├── js/arch3d.js           # 3D three-rail architecture (Canvas 2D)
│   ├── js/cinema.js           # comparison wall playback and paging
│   ├── figures/               # paper figures, WebP
│   ├── posters/               # 15 first-frame posters
│   ├── videos/                # 15 comparisons, 1664×536, uncropped
│   ├── og.png                 # social preview card (1200×630)
│   └── favicon.svg
└── tools/                     # asset builders and headless-browser checks
    ├── build_videos.py        # regenerate the #videoData playlist
    ├── build_table.py         # regenerate the VBench tables
    ├── restore_videos.py      # restore full-frame videos and posters
    ├── trim_caption.py        # alternative: crop the baked title row
    ├── render_figures.py      # paper figure PDF → PNG
    ├── make_og.py             # rebuild the social preview image
    ├── qa.mjs                 # 38 end-to-end checks over CDP
    ├── test-steps.mjs         # 10 checks for the step-compression canvas
    ├── test-perf.mjs          # frame-rate and reduced-motion checks
    └── shot.mjs               # element-level screenshots
```

---

## What to edit

Everything a reader sees lives in `index.html`. These are the blocks that change
most often.

| Content | Where |
| --- | --- |
| Authors and affiliations | `.authors`, `.affil`, `.authors__note` (the `*` equal contribution / `†` corresponding author / `‡` project leader legend) |
| Title, subtitle, tagline | `.hero__lockup`, `h1`, `.hero__sub`, `.hero__tagline` |
| Call-to-action buttons | `.cta-row` — swap the `Paper` placeholder for a real `href` once a public PDF exists |
| Abstract text | `.abstract-text` inside `#abstract` |
| BibTeX | the `<pre id="bibtex">` block in `#citation` |
| Social preview | `assets/og.png` (1200×630) and the `og:image` / `twitter:image` tags |
| Video playlist | `tools/build_videos.py` (`ORDER`, `TITLES`) → writes `#videoData` |
| VBench tables | `tools/build_table.py` (`ROWS`, `RANKS`) |
| 3D animation numbers | `STAGES` in `assets/js/steps3d.js`, `RAILS` in `assets/js/arch3d.js` |

### Rebuilding assets

```powershell
pip install pymupdf pillow imageio-ffmpeg
python tools/render_figures.py    # paper figures -> assets/figures/*.webp
python tools/restore_videos.py    # full-frame videos + posters (source: ../videos_original)
python tools/build_videos.py      # refresh the playlist JSON
python tools/make_og.py           # social preview card
```

---

## Design notes

<br>

### 🎬 The video wall

<p align="center">
  <img src="docs/video-wall.webp" width="100%" alt="Six side-by-side video comparisons playing at once: the base two-step student on the left of each cell, its StepBridge counterpart on the right">
</p>

The wall sits in the **hero**, directly under the title, where a static teaser
figure used to be. For a video paper the first screen should move.

**What it does**

- **Six pairs at once** in a 3 × 2 grid; the 15 clips form 3 sets of 6.
- Sets advance every 7.8 s, or on click / arrow keys.
- The last set wraps around to the front of the list, so the wall is **never
  partially empty** — 15 is not a multiple of six.
- Each cell is a left/right baked comparison: `ORIGINAL` on the left,
  `+ STEPBRIDGE` on the right, same prompt and same seed.
- Videos are **never cropped**: `object-fit: contain` inside a 4 px warm-white
  mat, with the baked title row kept at its original brightness.
- The card footer carries only `title + model + method`; the expand button
  appears on hover and opens a full-size lightbox.
- Responsive: 2 columns below 1100 px, a single column below 700 px, and on
  phones a *set* is 2 clips rather than 6 so the abstract is not pushed several
  screens down.
- Plays only while visible, pauses in background tabs, and under
  `prefers-reduced-motion` it shows the first frame and stops advancing.

<details>
<summary><b>Two traps worth remembering</b></summary>

<br>

**1 · Never overlay the baked title row.**
An earlier build added a dark gradient scrim over the top 15 % of each cell to
calm the white bars down. The baked bar is ~13 % of the frame, so the scrim
landed exactly on it and turned crisp dark text into grey mush — it read as two
layers stacked on top of each other. The scrim is gone; the bar keeps its own
contrast.

**2 · Bump the cache version when assets change in place.**
Videos are re-encoded under the same filenames, so browsers happily keep serving
the old bytes. `cinema.js` appends `?v=…` to video and poster URLs, and
`index.html` version-tags its CSS/JS. Increment both when replacing media.

</details>

<br>

### 🌐 The two 3D figures

<p align="center">
  <img src="docs/method.webp" width="100%" alt="Step-compression corridor above, three-rail architecture below">
</p>

Both figures are drawn by hand into a `<canvas>` with a small perspective
projection, `s = focal / (dist − z)`. There is no WebGL and no 3D library.

<table width="100%">
<tr>
<td width="50%" valign="top">

#### `steps3d.js` — step compression

A corridor threading the latent space. Each ring is one network evaluation:
50 dense rings for the teacher, 4 for the reference, 2 for the student — where
two rings also raise a dashed arch to mark the endpoint anchor. The
`50 ⟶ 4 ⟹ 2` strip below doubles as a legend and a stage selector (clicking
pins a stage for 14 s; arrow keys work too).

</td>
<td width="50%" valign="top">

#### `arch3d.js` — three rails

Three models on one clock: the 50-step teacher, the two-step student, and the
frozen four-step reference. Four questions were answered before any pixel was
drawn — input, trajectory alignment, distribution alignment, output.

</td>
</tr>
</table>

**The four questions behind the architecture figure**

| | Content | How it is drawn |
| --- | --- | --- |
| Input | prompt `c` plus two **independently sampled** noises `z_S, z_A` | two jittering particle clusters at the left end; a bowed arrow labelled `4-step ckpt` links the reference start to the student start |
| Alignment ① (trajectory, **two-way**) | the student proposes **key states**; the teacher returns the **velocity there** | violet dashed beam upward, solid blue beam downward, bowed in opposite directions so the loop is legible |
| Alignment ② (distribution) | `p_θ → p_A` with **no sample correspondence** | endpoints open into sample clouds, linked by **shuffled** pair lines; after anchoring the violet cloud settles onto the warm one |
| Output | `x̂ = G_θ(z_S, c)` at 2 NFE | a single point at the end of the student rail, labelled `x̂ / 2 NFE`; only the student rail is a solid ribbon |

**How "interval velocity" is made visible** — the core idea of the figure:

1. Two windows per coarse step (six in total) open from a point into a segment
   of width `w` as the light travels through them.
2. Above each window a **secant with an arrowhead** is drawn: the student's mean
   velocity over that interval, `v̄_S = (x̂(α+w) − x̂(α)) / (wΔσ)`. Heights
   alternate so neighbours never overlap; only the first window of each group
   carries the `mean over w` label.
3. What the student hands over is the **window midpoint** — not the start, not
   the end — and the violet arrow lands on the teacher rail.
4. The teacher's answer comes back as a blue solid beam that lands on that same
   midpoint.
5. Teacher ticks light up **only within a queried window**; outside it they stay
   dim, so the teacher never reads as running its own trajectory.

The point-supervision → interval-supervision distinction therefore needs no
prose: the target is visibly a chord spanning `w`, not a tangent at a point.

**One clock.** All three rails — including the four-step reference — share the
same `u`, the σ = 1 → 0 progress. The student crosses in **two big strides**
while the reference moves almost uniformly: same elapsed time, same path,
different step counts.

**Perspective floor.** A grid under the rails — lines parallel to the rails plus
cross lines converging on the vanishing point — fades with depth, with a soft
pool of light in the middle. It gives the rails a ground plane instead of
floating them on black.

<br>

### 🧭 The abstract flowchart

<table width="100%">
<tr>
<td width="52%" valign="top">
  <img src="docs/abstract.webp" width="470" alt="Abstract reading-guide flowchart">
</td>
<td width="48%" valign="top">

The right column of the abstract used to be empty. It now holds a vertical
flowchart that translates the abstract, sentence by sentence, into four stages:

| Stage | Abstract sentence it mirrors |
| --- | --- |
| ① The constraint | "…under a severely limited sampling budget" |
| ② Multi-step teacher / few-step generator | "…may not fully align with the student's compressed sampling process" |
| ③ StepBridge | "…combine trajectory-level and distribution-level supervision" |
| ④ Coordination | "…adaptive gradient scaling and asymmetric gradient projection" |

The same ① ② ③ ④ marks are embedded as small dots in the abstract prose.
Hovering a dot lights the matching card; clicking scrolls it into view and
pulses it. Wires are animated dashed SVG paths, static under
`prefers-reduced-motion`.

The column is `position: sticky`, so it stays visible while the abstract
scrolls. Below 980 px it collapses to a single column and moves **above** the
abstract, so readers see the diagram before the text.

</td>
</tr>
</table>

<br>

### 🏅 The emblem

<p align="center">
  <img src="docs/logo.svg" width="96" alt="StepBridge emblem">
</p>

One sentence: **a rise plus a flat run = two steps; a dashed chord = endpoint
anchoring.**

| Element | Meaning |
| --- | --- |
| A few scattered dots at the left | Gaussian noise (σ = 1), not yet formed |
| A steep blue segment | Step 1: crossing most of the trajectory |
| A small ring at the elbow | The only retained intermediate state |
| A warm horizontal run | Step 2: from the intermediate state to the endpoint |
| A thin dashed chord | Endpoint anchoring: the landing constraint from the frozen four-step reference |
| A glowing dot at the right | Clean latent (σ = 0) |
| Orbiting ring text | `TWO-STEP · TRAJECTORY + DISTRIBUTION` |
| Blue → violet → warm gradient | The same palette as the body text, 3D figures and table highlights |

<details>
<summary><b>Hard rules that came out of the iterations</b></summary>

<br>

1. **Exactly two segments.** Never a W-shape with three or four strides — that
   would silently contradict the "two-step" claim.
2. The elbow is deliberately wide (~60°) so the rise-then-run reading survives
   at 24 px.
3. The chord must be **dashed and thinner**, otherwise it reads as a second
   trajectory rather than a constraint.
4. The endpoint is a glowing dot, so it still reads as a landing point once
   detail is lost.
5. Ring text carries method keywords only — the full name turns to mush.

Where it appears: the 100 px emblem in the hero, a 40 × 40 simplified version in
the navigation bar, and the same mark in the favicon and `assets/og.png`.
Implementation: inline SVG on a 120 × 120 grid, ring text laid out with
`<textPath>` and rotated once per 44 s, polyline drawn in with
`stroke-dasharray` over 2.6 s, endpoint glow via radial gradient and a breathing
`scale`. Everything stops under `prefers-reduced-motion`.

</details>

<br>

### 📊 Results and analysis

<p align="center">
  <img src="docs/results.webp" width="100%" alt="Results section: five delta cards for SMD, DMD, DMD2, ADV and rCM">
</p>

<p align="center">
  <img src="docs/analysis.webp" width="100%" alt="Analysis section: ablation table, ladder chart and pull quote">
</p>

The results section leads with **five delta cards** — SMD, DMD, DMD2, ADV, rCM —
laid out as a centred 3 + 2 grid so the visual weight stays balanced at any
width. Below them, a gap-recovery bar chart shows what share of the two-step →
four-step gap each setting recovers, with anything above the 100 % line meaning
the two-step student overtook its own four-step reference.

The analysis section pairs prose with a pull quote that stays **dark in both
themes**: `--ink` flips to near-white in dark mode, which once turned that card
white and left the light body text unreadable.

---

## Engineering notes

<details>
<summary><b>Palette, type and layout decisions</b></summary>

<br>

- **Palette** comes from the paper: `#285FA6` (bridge blue), `#6A63A8`
  (transition violet), `#B86B4B` (bridge warm). Table highlights reuse the
  paper's red / blue / green semantics.
- **Type**: Instrument Serif for display, Inter for body, JetBrains Mono for
  code, with Georgia and the system stack as offline fallbacks.
- **The abstract** is justified and capped at 70 ch to keep line lengths
  readable; below 700 px justification is dropped because narrow columns open
  ugly word gaps.
- **Paper Figure 2** is a white-background illustration, so it is wrapped in a
  "sheet of paper" card (warm off-white, click to enlarge) rather than pasted as
  a raw image.
- **Both 3D canvases** use palette-independent colours, so switching themes
  needs no re-render logic.
- **Initial paint** loads fonts plus a single image; videos and posters are lazy
  and only start when the wall scrolls into view.
- **The comparison wall and both canvases** are `IntersectionObserver`-driven:
  off-screen work stops rather than draining battery.

</details>

---

## Automated checks

The QA scripts drive a real Chrome over the DevTools protocol, so they catch
layout and runtime problems that a static lint cannot.

```powershell
node tools/qa.mjs https://visualgenmi.github.io/StepBridge-Page/
node tools/test-steps.mjs http://127.0.0.1:8899/
node tools/test-perf.mjs  http://127.0.0.1:8899/
```

| Suite | Covers |
| --- | --- |
| `qa.mjs` — **38 checks** | title, playlist, wall layout and autoplay, paging, tables, theme, lightboxes, anchors, console errors, asset 200s, overflow at 1440 px and 390 px, mobile menu |
| `test-steps.mjs` — **10 checks** | stage cycling, `?steps=` deep link, HUD numbers, canvas painting |
| `test-perf.mjs` | animation frame-rate under load, `prefers-reduced-motion` behaviour |

`tools/shot.mjs <url> <w> <h> <out> <selector> <theme> <scroll> <wait>`
captures a single element — this is how every screenshot in `docs/` was made.

---

## Credits

- Method, figures and numbers come from the paper's own LaTeX sources and
  appendix tables (main results: Table 1; diversity: Table 2; ADV and rCM:
  Table S1; 14B: Table S3).
- Videos were generated at 2 NFE; each clip pairs the base two-step student
  (left) with its StepBridge counterpart (right) under identical prompt and seed.
- Figures and videos remain © the paper's authors. The page code is free to
  reuse.

<br>

<div align="center">
  <sub>MiLM Plus, Xiaomi Inc. · School of Computer Science, Wuhan University</sub>
  <br><br>
  <a href="https://visualgenmi.github.io/StepBridge-Page/">Project page</a> ·
  <a href="https://github.com/VisualGenMi/StepBridge">Code</a> ·
  <a href="https://github.com/VisualGenMi">Organisation</a>
</div>
