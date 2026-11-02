# Background bench

Two dependency-free Node scripts for judging a rewrite of
`src/lib/components/InteractiveBackground.svelte` against the DOM implementation described in
[BACKGROUND-REVIEW.md](./BACKGROUND-REVIEW.md): one measures frame pacing, main-thread cost and DOM
size; the other takes deterministic screenshots and diffs them in the browser.

## What the measurement covers

`scripts/measure-background.mjs` runs a fixed matrix, in this order, once per invocation:

| scenario                                          | why it is in the matrix                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1280×900, DPR 1                                   | desktop baseline, comparable to the review                                            |
| 390×844, DPR 3                                    | phone geometry; 9× the pixels to rasterise, which is where CSS `filter` cost shows up |
| 1280×900, DPR 1, `prefers-reduced-motion: reduce` | control row: what the page costs with the background animation off                    |

Each row launches a fresh browser, loads the page, waits for the background and a fixed 1.5 s settle,
then samples for 5 s. During the sample the pointer sweeps the viewport (left to right, with a sine
wave vertically) so parallax, star activation and constellation lines are exercised. A fresh browser
per row means renderer counters and the V8 heap start clean.

Measured per row:

| metric                                                                       | why it is here                                                                                                               |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `frames`, `mean`, `p50`, `p95`, `max` (ms)                                   | frame pacing. The mean hides stalls; p95 and max expose them.                                                                |
| `>16.7 ms`, `>33 ms`                                                         | counts of deltas over one and two 60 Hz budgets. `>33` is the useful "dropped frame" number. See the threshold caveat below. |
| `TaskDuration`, `ScriptDuration` (CDP `Performance.getMetrics` deltas)       | main-thread time in the window; `TaskDuration` is all tasks, `ScriptDuration` is JS only.                                    |
| busy %                                                                       | `TaskDuration / metrics window`. Directly comparable to the review's "main-thread busy".                                     |
| `LayoutCount`, `RecalcStyleCount`                                            | structural fingerprint of DOM-driven animation: the DOM version is ~1 layout and ~2 style recalcs per frame.                 |
| `JSHeapUsedSize`                                                             | end-of-window gauge, not a leak test. The delta is also written to JSON for completeness.                                    |
| elements inside `.interactive-background`, elements with a `style` attribute | the review's "96 nodes" claim, and the inline-style churn.                                                                   |
| pointer moves                                                                | sanity check that the interactive path actually ran.                                                                         |

The CDP window is read immediately before and after the rAF sample, so its duration is reported
(usually ~5.03 s). Per-frame ratios are more portable than raw counts.

### Why these metrics

The review's argument is structural: **one layout per frame and two style recalcs per frame** because
~96 DOM elements are restyled at 60 Hz, plus per-element `filter`. `LayoutCount` and
`RecalcStyleCount` are the numbers that prove or disprove that directly. Frame deltas prove whether
the user sees it; `TaskDuration` says where the main thread went. The phone row is the one that
matters for the "real phone will be worse" claim, and reduced motion is the control that separates
background cost from page cost.

## Determinism and repeatability

The measurement is fixed: same URL, same order, same viewports, same DPR, same reduced-motion mode,
same 1.5 s settle, same 5 s window, same pointer path. It uses headless Chromium with
`--disable-background-timer-throttling`, `--disable-renderer-backgrounding` and
`--disable-backgrounding-occluded-windows`; no window focus is required and no page is brought to the
front.

Two things are _not_ fixed:

- **Machine load.** On a shared machine, `TaskDuration` and busy % move by 10–30 % between runs even
  while frame pacing is identical. Run the matrix twice and compare, don't treat one row as truth.
- **Source state.** If the dev server or another agent edits the component while a run is happening,
  the numbers belong to different code. The script hashes the background source before and after each
  scenario and writes `sourceChangedDuringRun` plus a warning. Do not compare runs with different
  hashes.

The `>16.7 ms` counter is deliberately strict and is **not** a dropped-frame count: at 60 Hz, rAF
deltas quantise around 16.7–16.9 ms, so a healthy 60 fps run still reports roughly a third of frames
over 16.7. Use `>33 ms` (two missed budgets) for jank.

To reproduce the review's idle pointer numbers, run with `--no-pointer`. That flag is a diagnostic,
not part of the standard matrix; the default sweep is deliberate because it exposes the interactive
cost that an idle pointer hides.

## Running it

Start the dev server on 5212. Vite binds `localhost`/`::1` by default on this machine, while the
harness default is `127.0.0.1`, so pass the host explicitly:

```powershell
cd ivan-iliev-portfolio
$env:npm_config_cache = Join-Path (Get-Location) '.npm-cache'
npm.cmd run dev -- --port 5212 --host 127.0.0.1
```

Measure (from the repo root, in a second terminal):

```powershell
node scripts/measure-background.mjs
node scripts/measure-background.mjs --json .bench/measure.json
```

Capture before/after screenshots and diff them:

```powershell
node scripts/capture-background.mjs .bench/before
node scripts/capture-background.mjs .bench/after
node scripts/capture-background.mjs --diff .bench/before .bench/after
```

Both scripts use the local `playwright-core` at
`..\.scratch\node_modules\playwright-core` and chromium at
`%LOCALAPPDATA%\ms-playwright\chromium-1248\chrome-win64\chrome.exe` by default. Override with
`--playwright-core <dir>` / `--chrome <path>` or `PLAYWRIGHT_CORE` / `CHROME_PATH`. No packages are
installed by these scripts.

Exit codes are part of the contract: the measurement exits 1 if the background source changed during
the run (or on a failure); capture exits 1 if the two viewports were served different code or the
animation loop started late; `--diff` exits 1 on unreadable files or a dimension mismatch. A warning
alone is not a pass — the numbers are only a comparison when the source hash is stable.

## Reading the output

- **Frame pacing** is the first table. A rewrite that holds 60 Hz should show ~301 frames in 5 s,
  mean ≈16.66 ms, `>33` ≈ 0. A row with a doubled mean and a pile of `>33` missed frames is visibly
  janky.
- **Main thread + DOM** is the second table. For the DOM implementation, expect `layouts ≈ frames`
  and `recalcs ≈ 2 × frames`, with ~96 nodes and ~88 inline styles when the pointer is idle. For a
  canvas rewrite, layouts should be 0 and the layer should contain 1 canvas (0 inline styles).
- **RecalcStyleCount needs care.** In this Chromium build an animating canvas also shows roughly one
  style recalc per frame (303 for 301 frames), while the same page with the animation off shows ~0.
  Treat it as "style work in the window", not as proof of DOM churn. `LayoutCount`, node count and
  per-frame ratios are the structural discriminators.
- **Compare like with like.** Use the reduced-motion row as the page baseline. Compare `>33` counts
  and busy % across runs; ignore small heap differences. The phone row is the risk row.
- **Main thread ≠ raster thread.** CSS `filter` rasterisation can drop frames while `TaskDuration`
  stays low: the DOM phone row measured 41 % busy but 31 fps and 69 frames over 33 ms. Frame pacing
  and `TaskDuration` answer different questions.

## Captures and diff

Screenshots are only comparable if the background is deterministic. The scene is random and
time-driven, so a naive screenshot pair of the same code never matches. `capture-background.mjs`
therefore injects three controls before the app runs:

- `Math.random` is replaced with a fixed-seed Mulberry32 PRNG, so the scene layout is identical;
- `requestAnimationFrame` is queued, and the harness advances exactly 180 frames (3 s at 60 Hz)
  after a 3 s load warm-up, so the animation phase is identical;
- CSS animations and transitions are disabled, so their phase cannot leak into the image.

The pointer is parked at 72 % / 68 % of the viewport before the frame run, so parallax and the
constellation activation are identical too. Each run writes `1280x900-dpr1.png`,
`390x844-dpr3.png` and a `capture.json` that records the source hash, the **served** module hash,
`loopReady`, the number of callbacks advanced (180 expected) and the PNG hash.

`--diff` decodes each matching PNG in Chromium (file:// pages loaded into a canvas, with
`--allow-file-access-from-files`); there is no image dependency. Per pixel it takes the largest RGB
channel difference, then reports the mean over all pixels and the percentage of pixels over 8/255.
Dimension mismatches are errors; files are matched by name; `capture.json` is ignored. Two captures
of the same code should report **0.000 mean and 0.00 %**.

The diff is a still-frame comparison: it catches layer order, colour, sizes and layout, not motion
smoothness. Use the measurement for motion.

## Results

Fill these in from `measure-background.mjs`. The three standard rows are pre-filled; leave the cells
empty until a run is recorded.

### Frame pacing

| scenario              | frames | mean | p50 | p95 | max | >16.7 | >33 |
| --------------------- | ------ | ---- | --- | --- | --- | ----- | --- |
| 1280×900 DPR1         |        |      |     |     |     |       |     |
| 390×844 DPR3          |        |      |     |     |     |       |     |
| 1280×900 DPR1 reduced |        |      |     |     |     |       |     |

### Main thread and DOM

| scenario              | task s | busy % | script s | layouts (per frame) | recalcs (per frame) | heap MB | nodes | style attrs |
| --------------------- | ------ | ------ | -------- | ------------------- | ------------------- | ------- | ----- | ----------- |
| 1280×900 DPR1         |        |        |          |                     |                     |         |       |             |
| 390×844 DPR3          |        |        |          |                     |                     |         |       |             |
| 1280×900 DPR1 reduced |        |        |          |                     |                     |         |       |             |

## Reference numbers

Recorded while verifying this harness on 2026-11-02, Windows, Chromium 156.0.8078.4, Vite dev build,
shared machine (so busy % is noisier than the frame numbers). These are illustrative, not targets.

The rewrite landed while the harness was being built, so the DOM numbers were measured from a
`git archive 7be98c9` snapshot of the pre-rewrite code served on a second port; the canvas numbers
are from the working tree at source hash `910ac5a7c417bf81` (commit `e15b83c`).

### DOM implementation (HEAD snapshot)

| pointer | scenario      | frames | mean  | p95   | >33 | busy % | layouts | recalcs | nodes |
| ------- | ------------- | ------ | ----- | ----- | --- | ------ | ------- | ------- | ----- |
| idle    | 1280×900 DPR1 | 291    | 17.24 | 17.00 | 10  | 60.0   | 292     | 584     | 96    |
| idle    | 390×844 DPR3  | 263    | 19.07 | 33.39 | 36  | 47.5   | 264     | 528     | 96    |
| idle    | reduced       | 301    | 16.66 | 16.80 | 0   | 3.9    | 0       | 302     | 11    |
| sweep   | 1280×900 DPR1 | 258    | 19.44 | 33.40 | 43  | 53.6   | 259     | 520     | 116   |
| sweep   | 390×844 DPR3  | 155    | 32.36 | 83.30 | 69  | 41.0   | 158     | 321     | 264   |
| sweep   | reduced       | 301    | 16.66 | 16.80 | 0   | 5.2    | 0       | 305     | 11    |

The idle desktop row is the review's ~300/600 fingerprint. The sweep rows are worse on the phone
because the pointer activates a large fraction of the 50 stars, adding up to hundreds of SVG
`line` elements — the node count at the end of the sample is 264, not 96.

### Canvas rewrite (source `910ac5a7c417bf81`)

| run | scenario      | frames | mean  | p95   | >33 | busy % | layouts | recalcs | nodes |
| --- | ------------- | ------ | ----- | ----- | --- | ------ | ------- | ------- | ----- |
| 1   | 1280×900 DPR1 | 301    | 16.66 | 16.80 | 0   | 17.1   | 0       | 304     | 1     |
| 1   | 390×844 DPR3  | 301    | 16.67 | 16.80 | 0   | 16.4   | 10      | 305     | 1     |
| 1   | reduced       | 301    | 16.66 | 16.90 | 0   | 4.7    | 0       | 14      | 1     |
| 2   | 1280×900 DPR1 | 301    | 16.66 | 16.90 | 0   | 16.0   | 0       | 303     | 1     |
| 2   | 390×844 DPR3  | 301    | 16.66 | 16.80 | 0   | 17.9   | 10      | 306     | 1     |
| 2   | reduced       | 301    | 16.66 | 16.90 | 0   | 4.8    | 0       | 14      | 1     |

Frame pacing and structure are identical across the two runs; busy % moved by ~1–2 points (16.0 vs
17.1 desktop, 16.4 vs 17.9 phone), which is the machine-load caveat in practice. The phone row's 10
layouts are page-level (fonts/hover), not per-frame background work.

### Capture diff

| comparison          | file              | mean abs | % > 8/255 | max |
| ------------------- | ----------------- | -------- | --------- | --- |
| same code, two runs | 1280×900-dpr1.png | 0.000    | 0.00 %    | 0   |
| same code, two runs | 390×844-dpr3.png  | 0.000    | 0.00 %    | 0   |
| DOM HEAD vs canvas  | 1280×900-dpr1.png | 0.823    | 0.04 %    | 166 |
| DOM HEAD vs canvas  | 390×844-dpr3.png  | 1.126    | 0.11 %    | 122 |

The zero rows were re-confirmed on the final canvas source (`910ac5a7c417bf81`, served module hash
`ca3b4949ffb997c4`) with 180 callbacks per capture.

One capture pair made while `render.ts` was being edited reported 4.740 mean / 20.02 % on desktop;
the source hashes in the two manifests were different. That is the failure mode the source and served
hashes exist to expose: those images were not the same code.

## Caveats

- **Headless Chromium is indicative, not a phone.** DPR 3 increases the pixel count, but the CPU,
  GPU, thermal limits and memory are a desktop's. There is no CPU throttling or network shaping. A
  real phone will generally be worse on raster-bound frames.
- **Dev build.** The dev server serves unminified Svelte and Vite HMR code. Production numbers will
  differ; compare implementations within the same server mode.
- **Busy % is main-thread only.** Compositor/raster work (CSS filters, canvas rasterisation) is not
  in `TaskDuration`. Frame pacing is the user-facing truth.
- **Single 5 s window.** GC, a background build, or a browser update can land in it. Repeat and
  compare.
- **JSHeapUsedSize is a gauge.** It is useful to spot an order-of-magnitude regression; it is not a
  leak test.
- **`>16.7 ms` is quantisation-sensitive.** See above; rely on `>33 ms` for jank.
- **Captures are one frozen frame.** Seeded randomness and a fixed frame count make them comparable,
  but they say nothing about smoothness or about the distribution of random layouts.
- **Diff percentages are over the whole viewport.** Static page content dilutes them; a 0.04 %
  viewport diff can still be a visibly different background in a corner.
- **Source fingerprints only describe the checkout the script runs from.** When measuring a build
  served from elsewhere, the hash will not describe it. Capture manifests also record the hash of
  the modules the dev server actually served, which catches a stale Vite transform.
- **Reduced motion is a control, not a visual target.** The pre-rewrite component paints no stars in
  that mode; the rewrite paints a still frame. Both are valid rows for cost, not for appearance.
