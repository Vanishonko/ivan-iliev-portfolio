# SEO review — `seo/technical` (PR #6 → `develop`)

**Reviewed:** commit `a32b13d` ("SEO kit: structured data, canonical metadata, social cards, prerendering")
**Date:** 2026-11-03
**Scope:** all 14 prerendered routes, the generated build in `.svelte-kit/output/prerendered/pages/`, the Vercel build output, and the current production site at `https://www.ivaniliev.online`.
**Method:** production build (`npm run build`, exit 0), a static server over the built output, the dev server on `:5216`, Playwright/Chromium for rendered-DOM checks (JS on and off, client-side navigation), `scripts/seo-audit.mjs` against dev and production, `scripts/generate-og.mjs --check`, and manual inspection of every head, every JSON-LD block, the sitemap, the link graph, and the PNGs. Google/Bing were not reachable from this environment; schema was judged against the vocabulary and Google's documented requirements.

---

## Verdict

**Not search-ready today, but the code is close.** The branch build itself is technically sound: every route is fully prerendered, the head is complete in the static HTML, client-side navigation updates the head correctly (this is usually where SvelteKit portfolios fail), the sitemap matches the canonical set exactly, and the 404 is a real 404 with `noindex`.

But none of it is live. `www.ivaniliev.online` still serves `develop` (the pre-SEO build): no canonical, no JSON-LD, no `og:image` on any page, duplicate `<meta name="description">` tags on `/projects`, `/play`, `/lab` and even the 404, a 7-URL sitemap missing all seven project pages, and 404s for `/og/*`, `/icon-*.png` and `/manifest.webmanifest`. Running the branch's own audit against production returns **81 problems and exit 1**.

And the branch still ships some real defects: **7 of 8 project meta descriptions are hard-cut mid-word at 158 characters**, the work page claims "six projects" while rendering seven (in the `<h1>`, the meta description *and* the OG card), the `/lab` `ItemList` points three times at the same URL, the play pages have no `BreadcrumbList` although the brief requires it, and two public static game pages are indexable thin duplicates with missing or absent metadata.

Fix the copy and the schema semantics, delete or noindex the static game pages, merge, redeploy, then re-run the audit against production. That is a day of work, not a rebuild.

---

## Route-by-route

`Words` is words inside `<main>` in the prerendered HTML. `✓` means one correct, absolute, production-host, trailing-slash-free canonical.

| Route | Title (chars) | Meta description (chars) | Canonical | JSON-LD | Words | Main issues |
|---|---|---|---|---|---|---|
| `/` | `ivan iliev` (10) | 151 | ✓ | Person, WebSite | 572 | Title has no descriptor; `<h1>` is `[ivaniliev]`, not the name; JSON-LD in body |
| `/projects` | `work \| ivan iliev` (17) | 157 | ✓ | ItemList | 501 | "Six projects" for 7 cards (also in `<h1>` and `work.png`); `ListItem` has no `item`; no `url`/`numberOfItems` |
| `/projects/dewdrop-bend` | `dewdrop bend \| ivan iliev` (25) | 158, cut | ✓ | VideoGame, BreadcrumbList | 133 | Description ends `…moon rise be`; `sameAs: []`; second VideoGame entity for the same game |
| `/projects/driftblock` | `driftblock \| ivan iliev` (23) | 158, cut | ✓ | VideoGame, BreadcrumbList | 173 | Description cut at a comma; no link to `/play/driftblock` (links only to github.io) |
| `/projects/ai-f1-racing` | `ai-f1-racing \| ivan iliev` (25) | 158, cut | ✓ | CreativeWork, BreadcrumbList | 159 | Description ends `…antithetic pert`; tech stack in `genre` |
| `/projects/beaverwize` | `beaverwize \| ivan iliev` (23) | 158, cut | ✓ | CreativeWork, BreadcrumbList | 140 | Description ends `…conserve w`; 6 gallery images without dimensions |
| `/projects/laravel-nda` | `laravel web application \| ivan iliev` (36) | 158, cut | ✓ | CreativeWork, BreadcrumbList | 150 | Description ends `…Our soluti` |
| `/projects/dsh-works` | `dsh-works plugins \| ivan iliev` (30) | 158, cut | ✓ | CreativeWork, BreadcrumbList | 122 | Description ends `…looks at the r` |
| `/projects/portfolio` | `ivaniliev.online \| ivan iliev` (29) | 158, cut | ✓ | CreativeWork, BreadcrumbList | **32** | Thinnest page on the site; title repeats the brand twice; description ends `…and cloud` |
| `/lab` | `the lab \| ivan iliev` (20) | 147 | ✓ | ItemList | 618 | ItemList lists 3 items that all point to `/lab`; widget `<h2>` inside numbered sections; 5 images `alt=""` without dimensions |
| `/play` | `play \| ivan iliev` (17) | 145 | ✓ | ItemList | 127 | Title is an internal nav label; `ListItem` has no `item` |
| `/play/dewdrop-bend` | `dewdrop bend — play \| ivan iliev` (32) | 141 | ✓ | VideoGame | 202 | No BreadcrumbList (brief requires it); VideoGame description is `"Dewdrop Bend in the browser"` |
| `/play/driftblock` | `driftblock — play \| ivan iliev` (30) | 121 | ✓ | VideoGame | **92** | Thin; no breadcrumb; stub description; same query intent as `/projects/driftblock` |
| `/play/dragons` | `dragons (2015) — play \| ivan iliev` (34) | 135 | ✓ | VideoGame | 369 | No breadcrumb; no `<h2>` at all despite visual sections; stub description |
| `/this-page-does-not-exist` (404) | `page not found \| ivan iliev` | — | **canonical points at the missing URL** | none | ~10 | Correct 404 status + `noindex`, but `canonical` and `og:url` point at a page that does not exist |
| `/games/dewdrop-bend/index.html` (static) | `Dewdrop Bend` (12) | 67 | **none** | none | n/a | Indexable duplicate; no `<h1>`, no canonical, no robots, no OG; not in sitemap |
| `/games/dragons/start.html` (static) | **none** | **none** | **none** | none | n/a | 200 OK, `<html>` without `lang`, no title/meta/heading — a blank canvas document |

---

## Blocker

### B1. The branch is not what search engines see

`seo/technical` is one commit ahead of `develop` and is not deployed. Production is still `develop`. This is a release problem rather than a code defect, but it means every improvement in this PR currently counts for nothing.

Evidence — live `https://www.ivaniliev.online/projects`, raw HTML:

```html
<meta name="description" content="Ivan Iliev — ICT student at HZ University of Applied Sciences. …" />
<meta property="og:title" content="Ivan Iliev" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://www.ivaniliev.online" />
…
<meta name="description" content="Six projects: a pixel-art pond, a drift racing game, …" />
<meta property="og:title" content="Work | Ivan Iliev" />
```

Two `description` tags, no `canonical`, no `og:image`, no JSON-LD, and an `og:url` that is not the page URL. Running the branch's own checker:

```
$ node scripts/seo-audit.mjs --base https://www.ivaniliev.online
…
81 problem(s):
 - /: no canonical
 - /: no og:image
 - /play/dragons: no JSON-LD
 - 404 route not noindex (robots: null)
 - sitemap has 7 urls, expected at least 14
 - sitemap missing https://www.ivaniliev.online/projects/dewdrop-bend
 … (and 74 more)
$ echo $?
1
```

Live checks that confirm the same drift:

| URL | Result |
|---|---|
| `https://www.ivaniliev.online/sitemap.xml` | 7 `<loc>` entries; no project pages |
| `https://www.ivaniliev.online/og/home.png` | **404** |
| `https://www.ivaniliev.online/icon-192.png` | **404** (audit reports the same for `icon-512` and `apple-touch-icon`) |
| `https://www.ivaniliev.online/manifest.webmanifest` | **404** |
| `https://www.ivaniliev.online/nope-123` | 404 with the custom page, but **no `noindex`** |

The branch build is fine; production is stale. **Fix:** merge PR #6 into `develop`/`main`, deploy, then re-run `node scripts/seo-audit.mjs --base https://www.ivaniliev.online` and require exit 0 as a release gate. Until that passes, nothing else on this list is observable by a search engine.

---

## Should-fix

### S1. Project meta descriptions are cut mid-word by `.slice(0, 158)`

`src/routes/projects/[slug]/+page.svelte:26`:

```svelte
description={project.description[0].slice(0, 158)}
```

Every project page reuses the first paragraph of the body and chops it at character 158. The actual output, from the built pages:

| Route | Tail of `<meta name="description">` |
|---|---|
| `/projects/ai-f1-racing` | `…trained by an evolution strategy — antithetic pert` |
| `/projects/beaverwize` | `…It was designed to encourage people to conserve w` |
| `/projects/dewdrop-bend` | `…the sun and moon rise be` |
| `/projects/driftblock` | `…an engine synthesised entirely in Web Audio` (cut at a comma, no period) |
| `/projects/dsh-works` | `…looks at the r` |
| `/projects/laravel-nda` | `…documents. Our soluti` |
| `/projects/portfolio` | `…stars, constellations, auroras, and cloud` |

This is the most visible metadata defect on the site: these strings are what Google shows in a snippet (or, worse, a reason for Google to rewrite it), and `og:description` inherits them. It also cuts before the interesting part of several pages (the driftblock handling model, the ai-f1 determinism contract).

**Fix:** add an explicit `metaDescription: string` to the `Project` type in `src/lib/types.ts` and the data in `src/lib/data/projects.ts`, written by hand at 120–155 characters and front-loading the hook. Use `project.metaDescription` in `Seo`, not `description[0]`. If a fallback is needed, truncate on a word boundary and append `…` — never `slice` at a character count.

### S2. The work page says "six" while listing seven

Three separate places hard-code a count that the data contradicts:

- `src/routes/projects/+page.svelte:14` — description: `"Six projects: a pixel-art pond, a drift racer, …"`
- `src/routes/projects/+page.svelte:28` — `<h1>Six things I built, roughly in order of how much they hurt.</h1>`
- `scripts/generate-og.mjs:48` — social card copy: `"six projects, from a pond to a racing AI"`

`src/lib/data/projects.ts` has **seven** entries (`dewdrop-bend`, `driftblock`, `ai-f1-racing`, `beaverwize`, `laravel-nda`, `dsh-works`, `portfolio`), and `/projects` renders seven `<h2>` cards and seven `ListItem`s. The generated card is visibly wrong: `static/og/work.png` says "six projects" in 74 px type, and its subtitle lists only six names and omits `dsh-works` and `portfolio`.

`scripts/generate-og.mjs --check` returns 0, because it only checks that the file exists — not that its copy is still true.

**Fix:** derive the number from `projects.length` (or drop the count entirely — "Selected work" ages better), update the card copy, regenerate `static/og/work.png`, and add a test or audit check that fails when `projects.length` changes without the card being regenerated.

### S3. The home page's strongest signals are weak

- `<title>ivan iliev</title>` — 10 characters, no descriptor. It is the only page on the site without a `| ivan iliev` suffix, and it tells a searcher nothing about what the site is (`src/routes/+page.svelte:60`).
- The `<h1>` text is literally `[ivaniliev]` — brackets included, no space between "ivan" and "iliev". The markup splits every character into its own span, and the visual word gap is CSS `gap-x-3`, not a text space (`src/lib/constants.ts:9`, `src/routes/+page.svelte:80`, `src/app.css:40`). The prerendered `<h1>` contains no whitespace text nodes. So the most important heading on the site is a single non-word that nobody searches for; "Ivan Iliev" as a phrase appears only in the lowercase `<title>`.
- The other section titles are internal navigation labels, not search phrases: `work | ivan iliev`, `the lab | ivan iliev`, `play | ivan iliev`.

**Fix:** keep the typewriter styling but make the text real: render `Ivan Iliev` with a normal space (the brackets can be `::before`/`::after` pseudo-elements or `aria-hidden` decoration), and title the home page something like `Ivan Iliev — browser games, pixel art and tooling`. Consider descriptive section titles: `Work — browser games and web apps | Ivan Iliev`, `The lab — DeepSeek Harness plugins | Ivan Iliev`, `Play — browser games | Ivan Iliev`.

### S4. Two public static game pages are indexable thin duplicates

These are real documents in `static/`, served at 200 in production, not in the sitemap, and not linked by any `<a>` in the prerendered HTML (the "open standalone" link on `/play/dewdrop-bend` only exists after a click, inside `{#if started}` — so the pages are orphaned from the crawl graph but publicly reachable and may already be indexed from an earlier version of the site).

| File | What a crawler gets |
|---|---|
| `static/games/dewdrop-bend/index.html` | `<title>Dewdrop Bend</title>`, a 67-char description, **no `<h1>`, no canonical, no robots meta, no OG** — a second "Dewdrop Bend" page competing with `/play/dewdrop-bend` |
| `static/games/dragons/start.html` | `<html>` with **no `lang`**, **no `<title>`**, no meta description, no heading — a 136-line canvas document |

**Fix:** add `<meta name="robots" content="noindex, follow">` (and ideally a canonical to the matching `/play/*` URL) to both documents; add `lang="en"` and a `<title>` to `start.html` (it is an iframe document, so this also helps assistive tech). Alternatively `Disallow: /games/` in `robots.txt` — the files are only iframe assets, so blocking crawl costs nothing. Do not leave them as they are.

### S5. Structured-data semantics are sloppy in five places

The blocks parse and the required properties are there, but a reviewer or a validator would flag these:

1. **`sameAs: []`** — `/projects/dewdrop-bend` emits an empty array (`src/lib/seo.ts:109`). The code checks `project.links?.length` *before* filtering out internal links, so an internal-only link produces `sameAs: []`. Filter first, then check length.
2. **`/lab` ItemList points three times at the same URL** (`src/routes/lab/+page.svelte:14-19`): `Pip`, `Pixel art surface` and `Alerts bell` all have `url: "https://www.ivaniliev.online/lab"`. An ItemList of three distinct things that share one URL is not a list of anything. Either drop it (it adds no value for a non-rich-result type) or use fragment URLs (`/lab#pip`) and `item` instead of `url`.
3. **VideoGame descriptions are placeholders** — `/play/dewdrop-bend`: `"Dewdrop Bend in the browser"`, `/play/driftblock`: `"driftblock in the browser"`, `/play/dragons`: `"Dragons in the browser"` (`src/routes/play/*/+page.svelte`). This discards the real one-paragraph descriptions already on the page and gives Google nothing.
4. **`genre` is being used for tech stacks.** `src/lib/seo.ts:105` and `:163` pass `project.tags` / `game.genre` straight into `genre`, producing `["three.js", "Web Audio", "Gamepad API", "Force feedback"]` and `["SvelteKit", "Express", "Microservices", "API Gateway", "Data Viz"]`. Those are keywords, not genres. Use `genre: ["racing", "drift"]` for the game and `keywords: project.tags.join(", ")` for the stack.
5. **`ListItem` uses `url` where Google reads `item`** (`src/lib/seo.ts:88-92` and `:138-144`). `ListItem` inherits `url` from `Thing`, so this is valid schema.org, but the ItemList examples and parsers use `item`. It is dead weight as written; either switch to `item` or remove the lists.

Also worth correcting while in here: the same game is declared as two anonymous `VideoGame` entities with different `url` values (`/projects/dewdrop-bend` and `/play/dewdrop-bend`), with no shared `@id` and no `sameAs` between them. Give the game a stable `@id` on the play page and reference it from the project page (`subjectOf`/`sameAs`), so the two pages describe one entity rather than two.

### S6. The 404's canonical and `og:url` point at a URL that does not exist

`src/routes/+error.svelte:9-14` passes `path={$page.url.pathname}` into `<Seo>`. For `/this-page-does-not-exist-404` the rendered head contains:

```html
<link rel="canonical" href="https://www.ivaniliev.online/this-page-does-not-exist-404"/>
<meta property="og:url" content="https://www.ivaniliev.online/this-page-does-not-exist-404"/>
<meta name="robots" content="noindex, follow"/>
```

The status code (404) and `noindex` are correct, so the damage is limited, but a canonical that points at a missing page is a contradiction and a bad pattern to copy. **Fix:** make `path` optional in `Seo` and emit no canonical/`og:url` when `noindex` is set (or canonicalise the 404 to `/`).

### S7. Two indexable pages for "driftblock", one of them thin, and they do not link to each other

`/projects/driftblock` (173 words in `<main>`) and `/play/driftblock` (92 words) both self-canonicalise and both are indexable. They are not textually duplicated — 5-gram Jaccard is 0.004 — so this is not a duplicate-content penalty risk; it is query-intent cannibalisation plus a thin page:

- `/play/driftblock` is one paragraph, a launch button and a licence note, with **no image, no `<h2>` and a 121-character description**.
- `/projects/driftblock` links "Play it" to `https://vanishonko.github.io/driftblock/`, **not** to the internal `/play/driftblock`; the play page's only inbound link is `/play` (inbound count 1).

The same pattern exists for Dewdrop Bend (0.122 overlap), but there the play page has 202 words, images and feature cards, so it stands on its own — and the project page does link to it.

**Fix (preferred):** keep both, but give them distinct jobs and link them. Make `/play/driftblock` the playable page it claims to be: poster image, controls, credits, technical notes, a real VideoGame description, a BreadcrumbList, and a link back to the write-up. Point `/projects/driftblock`'s "Play it" at `/play/driftblock` and keep the github.io link as "open standalone". Add the shared `@id` from S5. Do not canonicalise one to the other — people search "play driftblock".

`/projects/portfolio` (32 words in `<main>`) is the other thin page: one paragraph about the site you are already on, no image, no `<h2>`, a title that repeats the brand (`ivaniliev.online | ivan iliev`). Either expand it with real detail (build, prerendering, measured Lighthouse/Web Vitals, the background canvas) or drop it from the project list and sitemap.

### S8. Sitemap `lastmod` is the build date on every URL

`src/routes/sitemap.xml/+server.ts:18,33`:

```ts
const today = new Date().toISOString().slice(0, 10);
…
<lastmod>${today}</lastmod>
```

All 14 URLs get the same date, and it changes on every build. The sitemap currently says every page was modified on 2026-11-03, which is false. Google ignores `lastmod` when it is not trustworthy, and `changefreq`/`priority` are ignored anyway. **Fix:** put a real date on each project (a `date`/`updated` field in `projects.ts`) and use it; for static routes either use the last content change or omit `lastmod`. Drop `changefreq` and `priority` while you are there.

### S9. The checker passes on a site with these defects

`node scripts/seo-audit.mjs --base http://127.0.0.1:5216` prints `all checks passed` while S1, S2, S5 and S8 are present. The gaps are structural, not accidental:

- `scripts/seo-audit.mjs:43-48` reads tags with a **first-match regex** (`/<meta\s+name="description"\s+content="([^"]*)"/`). It cannot see a duplicate tag — which is exactly the bug live production has today.
- `:106-114` checks that only **the first three** routes' `og:image` URLs resolve; the other eleven cards are never requested.
- `:88-91` checks that every expected route is in the sitemap, but never that every sitemap URL returns 200 — a sitemap entry pointing at a 404 would pass.
- It checks description length (70–165) but not whether the string ends mid-word; it never compares titles/descriptions for uniqueness; it never checks `og:image` dimensions; it never inspects the **built** output (`prerender` regressions are invisible); it never runs the rendered DOM, so a hydration bug would pass.
- There is no npm script and no CI workflow running it. `package.json` has `check` and `lint`, not `seo`.

**Fix:** run it against the built output and against production as a release gate; add duplicate-tag counting, title/description uniqueness, `og:image` dimension and status checks for every route, sitemap-URL status checks, and a rule that a description must end in punctuation or `…`. Also add a check that `/games/**` documents are `noindex` (S4).

### S10. Declared image dimensions do not match the files

Three files are declared with dimensions they do not have, which is exactly the kind of data that turns into layout shift when the CSS around it changes:

| File | Declared | Actual | Where |
|---|---|---|---|
| `/images/driftblock-gameplay.webp` | 1440×900 | **1280×800** | `/projects` card, `/play` card |
| `/images/dragons.webp` | 1440×900 | **800×600** | `/play` card |
| `/images/shower.webp` | 1440×900 | **695×999** | `/projects` card (BeaverWize poster) |

`/images/dragons.webp` is correctly declared 800×600 on `/play/dragons`, so the values are inconsistent per page. Six BeaverWize gallery images and five `/lab` sprite images have no `width`/`height` at all. The `aspect-*` wrappers currently prevent visible CLS, but the attributes are wrong and a future CSS change will expose it. **Fix:** use the intrinsic sizes (or omit the attributes where the wrapper fully controls the box).

---

## Nice-to-have

**N1. JSON-LD is in the body, not the head.** `src/lib/components/Seo.svelte:39` opens `<svelte:head>`, but the LD scripts are emitted at line 67 via `{@html ldScripts}`, i.e. inside `<div id="main">` in the body. Verified in every prerendered page (`jsonldInHead: false`) and in the live DOM (`Person@body`, `WebSite@body`). Google accepts JSON-LD in the body, so this is not a ranking problem — but the code comment and the PR description say "head", and a future maintainer will be confused. Moving it into `<svelte:head>` would need a different mechanism than `{@html}`; fixing the comment is the cheaper option. No action needed for SEO.

**N2. A third-party stylesheet is the only render-blocking surprise.** `src/routes/+layout.svelte:19-24` adds two preconnects and a Google Fonts `<link rel="stylesheet">`. PerformanceResourceTiming on the built output:

```
https://fonts.googleapis.com/css2?family=Courier+Prime…  blocking  dur=177ms
/_app/immutable/assets/0.DLahm5B2.css                     blocking  dur=36ms
```

So first paint waits on a request to a third party. `display=swap` avoids invisible text, but the sheet itself is blocking. Self-host the four Courier Prime faces (a handful of WOFF2 files) with `font-display: swap` and a `<link rel="preload">`, or load the sheet asynchronously. This is the largest remaining CWV lever and it also removes the last third-party dependency from a site that advertises "no trackers".

**N3. The apex → www redirect is a 307 (temporary).** `https://ivaniliev.online/` → `307 https://www.ivaniliev.online/`; `http://` → `https://` is a 308, and `http://www…/projects/` → 308 → `https://www…/projects/`. Since canonicals (once deployed) point at `www`, this is mitigated, but a temporary redirect is the wrong signal for a host canonicalisation. Change the Vercel domain redirect to 308. The footer's `https://ivaniliev.online` link is a needless hop for every page; point it at `https://www.ivaniliev.online`.

**N4. `Person` is valid but thin, and its references are unresolved on subpages.** Google's profile guidance recommends `image` (missing). `email` is `mailto:vanishonko@gmail.com` (`src/lib/seo.ts:41`) — `email` expects an address, not a URI; strip the scheme. And the `author` reference on every project and play page (plus `creator` on project pages) uses `{"@id": "https://www.ivaniliev.online/#person"}`, but the Person node is only declared on the home page, so those references resolve to nothing in the page's own graph. Include a one-line Person node (or inlined author object) on pages that reference it.

**N5. Breadcrumbs exist in JSON-LD but not on screen.** The project pages declare a three-level `BreadcrumbList` (`ivan iliev` → `work` → project) that matches the nav and the "← all work" link, and the names match the page titles. That is fine. A visible trail would help users and make the schema unambiguous. More importantly, **the play pages have no `BreadcrumbList` at all** — the brief says "VideoGame + BreadcrumbList on game and project pages"; only the project half shipped (S5-adjacent).

**N6. Open Graph nits.** `og:type="article"` is used for project and play pages without `article:published_time` (and "article" is a stretch for a play page); `og:image` is shared between `/projects/driftblock` and `/play/driftblock` (and the two Dewdrop pages), so two different URLs get identical previews; `twitter:image:alt` is missing while `og:image:alt` is present. Low value, five minutes.

**N7. Hero entrance animations delay the LCP paint.** `AnimatedSection` uses `animation: slideUp … both`, and `@keyframes slideUp` starts at `opacity: 0` (`src/app.css:107-116`). The home `<h1>` has a 200 ms delay and the subtitle 400 ms (`src/lib/constants.ts`), so the above-the-fold text is invisible for up to 400 ms after CSS is ready and LCP is recorded later than it needs to be. Reduced motion is correctly handled (`src/app.css:174-183`) — just skip the opacity animation for the hero (transform-only), or shorten the delays to ≤100 ms.

**N8. Small weight and hygiene items.** The favicon SVG is **30.8 KB** and is requested on every page (`/favicon.ico` returns 404, which is harmless but noisy). The manifest icons have no `purpose: "maskable"`. Total JS+CSS is ~60 KB gzip per page, 81 KB on `/lab` — fine for a portfolio. The twelve OG cards are 176–228 KB each at 1200×630 — all within every platform's limit; the home card (228 KB) could be quantised to ~80 KB with no visible loss.

**N9. Accessibility signals that touch SEO.** The good parts are real: `lang="en"` on every page, one `<h1>` on every page, no skipped heading levels, a skip link in the layout, and `prefers-reduced-motion`. The weak parts:
- `/lab` has five `alt=""` images, including the "plugin output" example (`PixelArtStudio.svelte:728-753`) — the sprites are arguably decorative, the example output is not.
- `/lab`'s widget injects an `<h2>Pixel Art Studio</h2>` in the middle of the page's numbered `<h2>` sections (between `02 — pixel art` and `03 — alerts`). Valid order, confusing outline.
- `/play/dragons` has no `<h2>` at all despite visually sectioned content (`before` / `this` / `after`, "the rest of the shelf").
- The skip link targets `<div id="main">`, which is not focusable; target `<main>` (or add `tabindex="-1"`).
- The 404 `<h1>` is three spans of one digit each; DOM text is `4\n0\n4`. Cosmetic, but a screen reader may read it as three items.

**N10. A page that forgets `<Seo>` would ship with no title.** `Seo` is per-page by design, so a new route inherits nothing from the layout (the layout only sets theme-color, icons, manifest and fonts). The audit covers the current 14 routes; a new page is unchecked. Add a default `<title>` and description in `+layout.svelte`, or a build-time assertion that every prerendered page has exactly one title/description/canonical.

---

## What is fine (checked, no action)

- **Prerendered HTML is complete.** With JavaScript disabled, all sampled routes (`/`, `/projects`, `/projects/dewdrop-bend`, `/lab`, `/play/driftblock`) still have their title, canonical, JSON-LD, `<h1>`, the full `<main>` text and visible content (opacity 1 after the CSS animation). Nothing important depends on hydration.
- **Client-side navigation updates the head correctly.** Tested `/` → `/projects` → `/projects/dewdrop-bend` → `/play` → `/play/driftblock` → `/`: `document.title`, `link[rel=canonical]`, `meta[name=robots]`, `meta[property=og:image]` all change per route, and the JSON-LD blocks are replaced, not appended — `Person+WebSite` on home, `ItemList` on `/projects`, `VideoGame+BreadcrumbList` on the project page, `VideoGame` on the play page, back to `Person+WebSite` on home. No stale or duplicated blocks, no hydration warnings.
- **One canonical URL per page.** Canonicals are absolute, on `https://www.ivaniliev.online`, with no trailing slash; `/projects/` returns 308 → `/projects` (verified in dev and in production).
- **No duplicate tags in the branch build.** Every one of the 14 pages has exactly one `<title>`, one description, one canonical, one robots, one `og:title`, one `twitter:card`. (Production duplicates the description on several pages — see B1.)
- **Sitemap and link graph are consistent.** 14 `<loc>` entries, exactly the 14 prerendered routes, no extras and none missing; every route returns 200; zero broken internal links; zero missing body assets; every page has inbound links (minimum 1: `/play/dragons`, `/play/driftblock`, `/projects/dsh-works`, `/projects/portfolio`), all reachable in ≤2 clicks from home. No orphans.
- **The 404 is a real 404.** `GET /this-page-does-not-exist-404` → status 404, `<title>page not found | ivan iliev</title>`, `<meta name="robots" content="noindex, follow">`, custom page. (Only the canonical is wrong — S6.)
- **OG assets are correct.** All twelve `og/*.png` are exactly 1200×630, all declared URLs exist in `static/`, sizes 176–228 KB, `og:image:width/height/alt` present, `twitter:card=summary_large_image`. Icons are 192×192, 512×512 and 180×180 as declared; the manifest parses and lists all three.
- **Structured data parses everywhere.** 14/14 pages, 22 blocks, zero parse errors; Person/WebSite `@id`s are stable (`#person`, `#website`) and `publisher`/`author` point at `#person`; BreadcrumbLists have correct `position`, names and absolute `item` URLs in the right order.
- **Metadata is unique.** No duplicate titles and no duplicate descriptions across the 14 pages; descriptions are 121–157 chars (the ones that are not truncated), titles 17–36 except home.
- **`generate-og.mjs --check` is a good idea** — it cross-references the hard-coded card list against `projects.ts` ids and fails when a project has no card. It just needs a content check too (S2).

---

## The three changes I would make first

1. **Merge and deploy, then prove it with the audit.** `node scripts/seo-audit.mjs --base https://www.ivaniliev.online` currently reports **81 problems** against a site that is supposed to have this work in it. Make that command (exit 0) the release gate. Nothing else in this document is visible to a crawler until this is done.
2. **Replace the `.slice(0, 158)` descriptions with hand-written ones, and stop hard-coding "six".** One `metaDescription` field per project, one `projects.length` in the copy, regenerate `static/og/work.png`. This fixes the seven broken snippets, the factually wrong `<h1>`/description/social card, and the stale card that `generate-og --check` happily passes.
3. **Take the static game pages out of the index and fix the driftblock link.** `noindex` (+ canonical to `/play/*` where it exists) on `static/games/dewdrop-bend/index.html` and `static/games/dragons/start.html`, and point `/projects/driftblock`'s "Play it" at `/play/driftblock`. That removes two indexable thin duplicates and gives the thin play page the internal link it is missing.

If there is time for a fourth: the structured-data clean-up in S5 (empty `sameAs`, the three-identical-URL `/lab` ItemList, the "…in the browser" VideoGame descriptions, `genre` vs `keywords`, `item` vs `url`, and the missing `BreadcrumbList` on play pages) — it is all in `src/lib/seo.ts` and two page files.

---

## Reproducing the key checks

```powershell
# build and inspect what a crawler actually receives
npm.cmd run build
Get-Content .svelte-kit\output\prerendered\pages\projects.html -Raw

# their audit, against dev and against production
npm.cmd run dev -- --port 5216 --host 127.0.0.1
node scripts/seo-audit.mjs --base http://127.0.0.1:5216     # "all checks passed"
node scripts/seo-audit.mjs --base https://www.ivaniliev.online  # 81 problems, exit 1

# social cards
node scripts/generate-og.mjs --check                          # exit 0

# live head
(Invoke-WebRequest https://www.ivaniliev.online/projects -UseBasicParsing).Content | Select-String 'canonical|og:image|ld\+json'
```
