# The interactive background — architecture review

`src/lib/components/InteractiveBackground.svelte` (622 lines) + `INTERACTIVE_BACKGROUND` in
`src/lib/constants.ts`. Mounted on `/`, `/lab`, `/play/*` and most project pages.

Verdict up front: **the effect is fine, the implementation is the problem.** It is not a canvas at
all — it is ~96 DOM elements re-styled by Svelte on every animation frame, with per-element CSS
filters. On a desktop that costs roughly half the main thread; on a phone it drops frames.

## What it actually is

```
onMount ──> initScene() ──> stars[] / particles[] / clouds[]   ($state, deep proxies)
                                   │
              tick() every rAF ────┤ update*() mutate the objects in place
                                   │ updateConnections() rebuilds an array of objects every 3rd frame
                                   ▼
                        Svelte re-renders the template
                                   │
        ┌──────────────────────────┼─────────────────────────────┐
        ▼                          ▼                             ▼
  50 <div.star>             30 <div.particle>              5 <div.cloud>
  filter: drop-shadow       filter: blur(50px)            filter: blur(60px)
        └────────────── one <svg> with N <line> constellation edges ──────────────┘
```

No canvas, no offscreen buffers, no `transform` batching. Every frame Svelte diffs four `{#each}`
blocks and rewrites ~96 inline `style` attributes; each `.star`/`.particle` then has to be
re-rasterised because it carries a `filter`.

## Measured

Headless Chromium 1248, dev build, `/` with the pointer idle, 5 s sample per row, CDP
`Performance` counters.

| viewport | DPR | nodes | mean frame | p95 | frames > 33 ms | layouts / 5 s | style recalcs / 5 s | main-thread busy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1280×900 | 1 | 96 | 16.63 ms | 16.8 ms | 0 | 302 | 604 | **2.65 s / 5 s ≈ 53 %** |
| 390×844 | 3 | 96 | 18.22 ms | 33.4 ms | **27** | 275 | 550 | **2.17 s ≈ 43 %** |
| 1280×900, reduced motion | 1 | 11 | 16.66 ms | 16.9 ms | 0 | **0** | 301 | 0.34 s ≈ 7 % |

Read that last row first: with the animation off, the page does **zero** layouts and a seventh of
the work. Essentially all of the cost above is this component.

Caveats: dev build (unminified Svelte), headless, idle pointer. Real numbers on a phone will be
worse, not better, because CSS `filter` cost scales with pixels — at DPR 3 there are nine times as
many pixels to blur as at DPR 1.

## Ranked problems

**1. The DOM is the render loop (dominant).**
96 elements re-styled per frame → 60 layout passes and 120 style recalcs per second. Svelte is
doing precisely the work reactive UI is bad at: 60 Hz, fixed-shape, throw-away updates. Evidence:
`LayoutCount` == one per frame; `RecalcStyleCount` == two per frame.

**2. Per-element CSS filters.**
`filter: blur(50px)` on each of 30 particles and `drop-shadow` on 50 stars. A filter forces a
rasterisation pass of that element's layer every frame it changes — this is why the phone rows show
27 frames over 33 ms. This is the single most expensive property in the file.

**3. `$state` deep proxies for simulation data.**
`stars`, `particles`, `clouds`, `connections` are `$state` arrays of objects, mutated per frame
(`particle.x = …`). Svelte 5 wraps every object in a proxy, so each write goes through a trap and
schedules invalidation — for data that is never read declaratively except in the template loop.
`updateConnections()` additionally allocates a `Map`, an array and N fresh objects every third
frame, then reassigns `connections` wholesale.

**4. SVG constellation lines.**
Each connection is a real `<line>` with a gradient stroke and a per-frame `stroke-dasharray`
recomputed from `conn.distance * conn.progress`. SVG geometry is layout-priced, so every dash change
is another layout invalidation.

**5. Layout reads inside the loop.**
`getBounds()` reads `container.offsetWidth/offsetHeight` on every tick — a forced style/layout read
per frame, on the same thread doing the writes.

**6. Resize re-randomises the scene.**
`onResize → initScene()` regenerates every star and particle from scratch: a visible reshuffle on
every window drag, plus the init cost, with no debounce.

**7. Parallax through CSS custom properties.**
`style="--px: …; --py: …"` on the container invalidates the style of every descendant on every
pointer move; the four layers then recompute `translate3d(calc(var(--px) * …))`. Cheap-ish because
it is pointer-rate, but it compounds problem 1.

## What I would keep

The *design* is right: four depth layers, a slow parallax on pointer, stars that activate near the
cursor and draw constellation lines, soft coloured bokeh behind the content, an aurora wash. That is
all reproducible on a canvas at a fraction of the cost, and it is the reason the site does not look
like a template. Keep the tuning data in `constants.ts` — the counts, sizes, timings and palette are
good and should not change in the rewrite.

## Plan

**Phase 1 — structural rewrite to a single canvas (the real fix).**
One `<canvas>` at `min(devicePixelRatio, 2)`, one `requestAnimationFrame`.
- Stars: pre-render one small radial-gradient sprite per size bucket; draw with `drawImage`
  (no `drop-shadow`). Static star layer cached to an `OffscreenCanvas` and only re-rendered when the
  viewport changes; the animated layer is just the activated stars and their twinkle.
- Particles: pre-render blurred sprites **once per tint** into an offscreen canvas (the blur becomes
  a bitmap, not a per-frame filter), then `drawImage` with alpha.
- Clouds: same trick — a few blurred sprites, drawn with scale.
- Constellation lines: a single `ctx.beginPath()` + `moveTo/lineTo` per line, one `stroke()` for the
  whole set, no dash maths in the loop (dash can become a per-segment alpha ramp).
- Aurora: keep as CSS (it is a static blurred gradient that only parallaxes) — one element, no
  per-frame work.
Expected: main-thread busy from ~53 % to under 5 %, zero layout passes, no per-frame filters.

**Phase 2 — correctness and lifecycle.**
- `ResizeObserver` instead of `offsetWidth` per frame; debounce re-init and keep existing positions
  on resize (no reshuffle).
- Pause on `document.hidden` (already done) **and** when the layer is scrolled out of view /
  `IntersectionObserver` if it is ever not fixed.
- `prefers-reduced-motion`: static painted frame, no rAF at all (today it returns early — good,
  keep that, but also paint one frame so the background does not vanish into the gradient).
- Cap DPR at 2; skip the canvas entirely under `(max-width: 480px)` if the frame governor trips.

**Phase 3 — adaptive quality (cheap insurance).**
A frame-time governor: keep a rolling p95 of the last ~60 frames and drop quality tiers
(counts → blur sprites → constellation lines → animation off) if it stays above 20 ms. The tuning
data already parameterises all the counts, so this is a small addition, and it means a weak phone
gets a still background rather than a slideshow.

## Risks

- A canvas rewrite is a visual change by definition. Mitigate by porting the constants untouched and
  comparing screenshots at 1280×900 and 390×844 before/after.
- Canvas cannot be styled by CSS; the aurora stays DOM so the two must agree on z-order.
- Pre-rendered blur sprites are approximations of `filter: blur`; sizes need one visual pass.
- Accessibility is unchanged: the layer is `aria-hidden` and purely decorative in both designs.

## Targets after Phase 1

| metric | now (desktop) | target |
| --- | --- | --- |
| main-thread busy, 5 s | ~53 % | < 8 % |
| layouts per frame | 1 | 0 |
| style recalcs per frame | 2 | 0 (canvas) |
| frames > 33 ms, 5 s, phone | 27 | 0–2 |
| nodes in the layer | 96 | ≤ 3 (canvas + aurora + wrapper) |
