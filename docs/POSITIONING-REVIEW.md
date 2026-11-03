# Positioning Review — ivaniliev.online

**Branch:** `seo/technical` (working tree clean; no source changes made)
**Reviewed:** 3 November 2026 · all 14 routes at 1280×900 and 390×844 · keyboard walk-through · axe-core 4.14 · rendered-pixel contrast measurement · reduced-motion emulation

## Verdict

The first screen passes the literal brief — name, city, “open to work”, browser projects, CV — but it never names the job Ivan wants, shows none of the work, and offers no way to make contact. The project pages prove real craft on the games and the lab, while the two professional projects are written in a passive team voice that hides what Ivan actually did, and the most distinctive work — the dsh-works tooling — is buried sixth in a list that calls itself six things when it has seven. Accessibility is better than most portfolios (skip link, real reduced-motion, working keyboard Pip and pixel studio), but the lab’s micro-labels fail contrast, the name is announced letter by letter, and the gallery dialog drops focus; the net read is “talented student who makes polished browser games and has done some team coursework”, not yet “junior developer who ships”.

## 1. The 10-second test

Without scrolling, at both 1280×900 and 390×844, the first screen is the hero only. It says:

> Vlissingen, NL · open to work
>
> [ivan iliev]
>
> ICT Student at HZ University of Applied Sciences. I build things that run in a browser and do something you can watch — a pond that keeps time, a drift racer with no assets, a racing AI that trains itself, and a workshop of tools for an agent I use every day.
>
> see the work →   visit the lab   download cv

**What lands.**

- It is immediately clear that this person builds software, and the examples are concrete: a pond, a racer, a racing AI, agent tooling. “Things that run in a browser and do something you can watch” is a good plain description of the work.
- The green badge says “open to work”, and the CV is visible twice on desktop (nav and hero). A stranger does not have to hunt for availability.
- The name and location are unambiguous. The dry tone starts here, not later.
- The examples cover games, simulation and tooling, which is a more interesting mix than “web developer”.

**What does not land.**

- **The site never says “developer”, “engineer”, or even “junior”.** The only role noun on the page is “ICT student”. The structured data in the page source says `jobTitle: "ICT student and developer"`; a human visitor never sees that. The first screen tells you what Ivan is studying, not what he wants to be hired as.
- **It shows no work.** The hero is a text block on a starfield. The best visual proof the site owns — the Dewdrop Bend screenshot, the driftblock frame, Pip — is at least one scroll away, and the work list itself is text-only. A hiring manager can read the claim but not see the artefact.
- **There is no contact action.** “Open to work” is a label, not a link. Email, LinkedIn and GitHub are at the bottom of the page (and in the footer); the hero offers CV but not conversation.
- **“An agent” is unexplained.** “A workshop of tools for an agent I use every day” is the most distinctive line in the hero, and a general hiring manager may not know that “agent” means a coding agent/harness. The lab explains it; the first screen does not.
- **The examples narrow the profile.** They are two games, an AI and AI tooling. The conventional web work that makes him employable — SvelteKit, Express, Laravel, MySQL, Docker — is not represented above the fold. If he wants a general junior developer role, the first screen reads more like “creative/game student” than “web developer”.
- **No timing.** “Open to work” does not say internship vs junior role, or when he is available. The bottom contact section says “final stretch at HZ” and “internship, a junior role, or a project”; that is three screens down.

**Result:** passes “what his projects are” and “looking for work”; partial on “what kind of developer” and weak on “why hire him now”. The content is good; the frame around it is too modest.

## 2. Project clarity

Each project page is currently `h1` + subtitle + tags + two unheaded paragraphs + media + note + links. There is no meta row (year, role, solo/team, status), no section headings, and — on most pages — no primary action near the top.

| Project | What it is | What’s clear after reading | What’s missing |
| --- | --- | --- | --- |
| **Dewdrop Bend** — pass | A 24-hour pixel-art pond with thirteen creatures, a draggable clock, planting, weather and field notes; vanilla JS + Canvas 2D, no dependencies. | What it is, the constraints (“no frameworks, no runtime dependencies, no external image or sound files”), and the craft. It is playable and has screenshots. | No year or explicit solo credit. The “Visit the pond” link sits below the full-width gallery, not next to the title. The source is private, which the play page says but the project page does not. |
| **driftblock** — pass | A 3D drift racer with four procedural circuits, a synthesised engine, gamepad/wheel support and force feedback; three.js, no build step. | What it is, what was hard (the forward/lateral velocity model, gearbox, force feedback), and how to run it. Playable + GitHub. | No year or solo credit. The car credit contradicts the description: the project page says the imported car is a “graphite-black Mercedes SLK”; the play page credits a modified “Citroen C5 Sedan And Estate” by Nieve5677. The 28 MB payload is only disclosed on the play page. |
| **ai-f1-racing** — partial | A top-down Formula 1 racing AI: a 38–16–3 network trained by an evolution strategy against a deterministic 60 Hz simulation, on circuits traced from Spa and Baku. | What it is, the central constraint (determinism), and the honest limit (“cars cannot yet see or hit each other”). | No demo, GIF, lap trace, training curve or screenshot; GitHub is the only proof. The “within about 0.1%” claim has no supporting artefact. The prose is dense with ML jargon for a non-ML hiring manager. No year. |
| **BeaverWize** — fail | A gamified water-conservation app: SvelteKit + Express microservices, measurements, statistics, achievements, community goals, brand rewards. | The feature set and the stack; the screenshots show the product. | Almost everything a hiring manager needs: Ivan’s role, team size, duration, what was hard, what he personally built, and the outcome. No demo or code link. The voice is passive and specification-like — “was an application developed using…”, “The concept also focused on…” — with no “I”. Reads like a course report. |
| **Laravel Web Application** — fail | An NDA Laravel/MySQL/Docker application that replaced spreadsheet-and-paper workflows for a steel producer; auth, RBAC, notifications, export. | The business problem and the feature list; the NDA limit is stated honestly. | Ivan’s role and personal contribution (“I was part of a team” then “Our solution” is not enough), team size, scale (users, records, sites), the hard part, a measurable result, the year, and any non-NDA proof. “One of the largest international steel producers” and “significantly smoother and more reliable” are unquantified. |
| **dsh-works plugins** — partial | Three DeepSeek Harness plugins: a pixel-art surface where the model draws and reviews, Pip the 32×32 creature, and an alerts bell for turn duration/tokens/cost. | What they do and the engineering constraints (“no runtime dependencies”, “every suite runs offline”). This is exactly the proactive tooling story. | A link to `/lab`, where the plugins actually run. The only link is the dsh-works organisation page, which contains no project repositories — clicking the one action leads to an empty shelf. No screenshots on the page, no year, no public code. |
| **ivaniliev.online** — fail / filler | This website: SvelteKit + Tailwind, custom interactive background with stars, constellations, auroras and clouds. | The stack. | What was hard, what Ivan did, why it belongs in the work list. “A minimalist galaxy-themed portfolio” is the most generic sentence on the site, and the card makes the page show seven projects while the header says six. It dilutes an otherwise strong list. |

**The common failure is structural, not literary.** Every page is two undifferentiated paragraphs. A skimming reader cannot jump to “what I did” or “what was hard” because there are no headings; the primary link is at the bottom; the page has no year or role. For a hiring manager, the difference between a case study and an essay is usually a meta row and three headings.

**Which pages fail the “what / hard / author” test:**

- **BeaverWize** and **Laravel** fail “what the author did”. They are the two professional projects, and they are the vaguest pages on the site. This is the single biggest content gap.
- **ai-f1** passes “what” and “hard”, but fails “show me”: there is nothing to look at and no runnable link.
- **dsh-works** passes “what” and “hard”, but fails “link to something runnable” even though the runnable proof exists on the same site.
- **ivaniliev.online** fails all three except “what it is”; it reads as filler.

**Count and ordering.** `/projects` says “Six things I built” and its meta description says “Six projects”, but the page renders seven cards; the seventh is “this website”. The subtitle list also enumerates six, excluding the portfolio. Either the portfolio is not a “thing I built” (then it should not be a peer card), or the header is wrong. The ordering (“roughly in order of how much they hurt”) puts the two games and the AI first, the two professional projects next, and the proactive tooling sixth; a hiring manager scanning top-to-bottom sees “student games” before “developer who builds tools”.

## 3. The proactive angle

The site has the evidence for the story Ivan wants to tell. Most of it is filed under “the lab” or “how it got here”, which is the wrong shelf.

**Strongest signals**

1. **The lab is the best thing on the site.** “Private repositories, public proof.” is a strong, honest framing, and it is immediately backed by working surfaces: the real Pip sprite data, a real 32×32 editor with a working PNG export, and a readable alerts mock. The pixel studio is not a screenshot; it loads, draws, undoes, downloads, and responds to the keyboard. This is the difference between “I build tools” and “here is a tool”.
2. **The hero’s “workshop of tools for an agent I use every day”** is specific and unusual. It says he noticed friction in his own workflow and built for it. It is the most “proactive” sentence on the site; it just needs to be understandable to a non-agent user.
3. **The dsh-works description** is full of the right kind of detail: host half/browser half, no runtime dependencies, PNG and GIF encoders written against `node:`, offline tests, no model and no network. That is engineering discipline, not a hobby.
4. **The 2012–2026 timeline** tells a long arc: Telerik at eight, JavaScript games at ten, a surviving repository at eleven, mentoring at twenty, C#/.NET at twenty-one, professional work at twenty-two, “the year the projects stopped being assignments” at twenty-two. “Software that had to work for someone who was not me” is a mature sentence. The timeline is the best answer to “is he proactive?”.
5. **The constraints on the games** — “no frameworks, no runtime dependencies” for Dewdrop, “no build step” for driftblock — are evidence of someone who chooses a hard constraint and ships inside it. They read as craft, not cost-cutting.
6. **The dry, specific tone** (“roughly in order of how much they hurt”, “the year the projects stopped being assignments”, “same kid, better tooling”) signals someone who has actually shipped and knows what it costs. It is the opposite of hype.

**Weakest signals**

1. **The proactive work is buried.** dsh-works is sixth of seven on `/projects` and absent from the five-item “selected work” on the home page. The lab teaser comes after the work list. The strongest evidence for the owner’s stated goal is the least prominent thing in the shop window.
2. **The private-code framing undercuts it.** “I am not ready to defend every line of it in public” invites the reader to assume the code is not good enough to show. “Ask and you shall receive” and “I would rather share it with someone curious than polish it for nobody” change the register from confident builder to someone asking for attention. The honesty is admirable; the effect is defensive.
3. **The two professional projects are the least specific pages.** BeaverWize and Laravel are where a hiring manager looks for evidence that Ivan can work with a team, a client and a deadline. Both hide his contribution behind passive/team language. The site therefore proves the hobby story better than the employability story.
4. **Four of seven project cards have no image.** The fallback is a large first tag (“TYPESCRIPT”, “LARAVEL”, “NODE.JS”, “SVELTEKIT”) in an otherwise empty 16:10 panel. It reads as a missing screenshot, not a design choice. The richest visual evidence is in the lab; the work list looks unfinished by comparison.
5. **The only role noun is “ICT student”.** A hiring manager has to infer “developer” from the work. The hero’s examples reinforce “games/AI”, not “web developer”. The site’s own structured data knows the answer; the visible page does not say it.
6. **“This website” is filler.** It is the weakest card and the one that breaks the count. “Galaxy-themed” is the only generic phrase in an otherwise specific site.

**Which story wins?** If a hiring manager reads only the hero and `/projects`, the takeaway is: *a talented student who makes polished browser games, has done some team coursework, and keeps a private workshop.* If they read `/lab` and the timeline, the takeaway is: *a self-directed builder who has been at this since he was eight, ships real things, and builds his own tooling.* The second story is the true one and the one Ivan wants; the site makes the reader work for it. The fix is promotion and specificity, not more adjectives.

## 4. Voice and credibility

The dry tone is the site’s strongest stylistic asset, and it is consistent across the home page, the lab and the game pages. Lines that land:

- “Six things I built, roughly in order of how much they hurt.”
- “The year the projects stopped being assignments.”
- “It is exactly as good as an eleven-year-old’s first repository should be.”
- “Same kid, better tooling.”
- “No runtime dependencies — the PNG and GIF encoders are written against `node:` — and every suite runs offline.”
- “No telemetry, no account, no dashboard to log into.”

The voice slips in a few places:

- **“Ask and you shall receive.”** A biblical register in the middle of a technical page; it reads like a pitch, not the rest of the site.
- **“I would rather share it with someone curious than polish it for nobody.”** Self-pity, and it undervalues the work. A reader who was interested is now being asked to reassure the author.
- **“I am not ready to defend every line of it in public.”** The most damaging sentence on the site. It is honest, but it tells a sceptical reader that the best work may not withstand review. The same page already explains why the repos are private; this line adds doubt, not transparency.
- **“A minimalist galaxy-themed portfolio.”** Generic; the only sentence that could belong to anyone.
- **“It resulted in a significantly smoother and more reliable workflow.”** Unquantified corporate language; the only hype-adjacent claim on the site. “One of the largest international steel producers” is likewise unverifiable by design (NDA), which is fine, but the two together read like a CV cliché.
- **“Six things” on a page with seven.** Small, but it is the kind of error a detail-oriented hiring manager notices, and it sits directly under the headline.
- **“One page” in the footer of a 14-route site.** Plainly false. “No telemetry · no trackers” is mostly true — there is no analytics in the source — but the site loads Google Fonts from `fonts.googleapis.com`, so a strict privacy reader will raise an eyebrow at “no trackers” too.
- **The driftblock credit mismatch.** The project page calls the imported car a “graphite-black Mercedes SLK”; the play page credits a modified “Citroen C5 Sedan And Estate” by Nieve5677. It may be a Citroën base restyled as an SLK, but the reader sees two different cars and no explanation.

**What a sceptical reader would not believe:** the precision without an artefact. “Spa-Francorchamps and Baku are traced … to within about 0.1 % of their true lap lengths” is a strong claim with no source, screenshot or test output on the page. “Every suite runs offline” is unverifiable while the repositories are private. “25 sheets and 113 frames” is a number a visitor cannot check; the site ships 12 visible Pip sheets. None of these are implausible, but they are the kind of precise claim that invites verification and then withholds it.

**What builds trust:** the honesty about ai-f1’s missing collisions, the Dragons page’s unflinching self-assessment (“no delta time… collisions are rectangles… I stole [the sky] from the internet”), and the fact that the demos are real. The site is not hypey. Its credibility risk is small factual slips and unverifiable precision, not overclaiming.

## 5. Structure for a skimming reader

**Home.** The order is good: hero → selected work → lab → timeline → contact. The timeline is a genuinely differentiated section. Two problems: contact is at the very bottom, and the selected-work list has no images. A skimmer gets a name, a claim, five text rows, a lab card, a long timeline, then contact. The strongest proof (lab) and the most human story (timeline) are both below the first scroll.

**`/projects`.** The cards are scannable: title, subtitle, three-line description, three tags, “read →”. But they omit year, role and status, and four of the seven have no visual. The page says six; it renders seven. The grid leaves a lonely seventh card in the last row. It is a good list that has not been curated for a hiring manager.

**Project pages.** The first screen is a wall of text. There is no meta row, no `h2`, no “what I did” section, no date, and — on most pages — no primary action above the fold. The playable/github links sit after the media, often below 900px. There is no next/previous project navigation; the only way to browse is back to `/projects`.

**`/lab`.** The numbered sections (01 Pip, 02 pixel art, 03 alerts) are clear and the heading “Private repositories, public proof.” does a lot of work. The page is long and the studio is dense, but it rewards reading. The “Ask and you shall receive” box competes with the proof and should not be the second thing a reader sees.

**`/play`.** Clear three-card layout. “play →” goes to a launch page, not directly into the game; that is an extra click, and the label slightly overpromises. The launch pages themselves are good: they explain the payload, expose fullscreen and standalone, and Dewdrop’s in-game screen even has a keyboard-accessible control panel.

**CV.** Desktop: in the nav on every page, and in the hero. Mobile: the nav hides it (`sm:inline-block`); only the home hero has it. On `/projects` and all project pages at 390×844 there is no visible CV link at all. A recruiter who lands on a project page from a shared link cannot download the CV without going home. The file itself is fine (`application/pdf`, ~78 KB, 200).

**Contact.** The footer has email, LinkedIn, GitHub on every page, and the home page has a dedicated “Looking for someone who ships?” card. But there is no “contact” item in the nav and no email action in the hero; “open to work” is not clickable. Contact is reachable, not obvious.

**Footer.** “© 2026 Ivan Iliev. Built with SvelteKit and too many stars.” is good. “no telemetry · no trackers · one page” is wrong on the last item and arguable on the second.

## 6. Accessibility as a reader

**Method.** axe-core 4.14 found **no WCAG A/AA violations**, but it reported contrast as “incomplete” on every page (54 nodes on `/lab`) because of translucent cards and canvas backgrounds. I measured rendered pixels separately. A clean axe run is not a clean bill here.

**What works**

- Skip link is first in the tab order and works.
- One `<main>`, one `h1` per page, labelled nav and footer.
- Visible focus: default outline on links, custom ring on the Pip stage, custom ring on the pixel canvas and studio controls.
- **Pip is genuinely keyboard-accessible.** Focus the stage and press Enter/Space: the pose changes, the polite live region announces the reaction, and the focus ring is visible. A screen-reader user gets “Pip the pixel creature. Click him, or press Enter or Space, for a reaction.”
- **The pixel studio is genuinely keyboard-accessible.** The canvas takes focus, arrow keys move a cursor, Space paints, Ctrl/Cmd+Z undoes, the status line announces the action, and the tool/palette/gallery buttons have names. This is rare in a portfolio toy.
- **The game launchers are real buttons** and launch by keyboard. The Dewdrop iframe has a keyboard cursor, a full control panel and a live region; driftblock has keyboard controls. The ancient Dragons game is mouse-only, but the page says so (“mouse to fly · space to restart”).
- **Reduced motion is real, not a CSS gesture.** With `prefers-reduced-motion: reduce`, the slide-up sections and caret animation are `none`, the background canvas does not change over 700 ms, Pip stops its loop and spawns no particles, and the studio sprite animations stop. The CSS, the canvas and the component logic all respect it.
- Responsive reflow is clean; no horizontal overflow at 320 or 390 px on any route.

**What fails or is weak**

1. **The lab’s small text fails contrast, badly.** These are measured ratios of the rendered text against the rendered background, not estimates from class names:

| Where | Text | Size | Ratio |
| --- | --- | --- | --- |
| Pip header | “32 × 32” | 10 px | **2.38:1** |
| Pip footer | “SPACE / ENTER” | 9 px | **2.38:1** |
| Pixel studio | “Drag to paint · Right-click to sample · Keyboard…” | 9.6 px | **2.93:1** |
| Pixel studio | status line (“Blank canvas — draw something…”) | 10.4 px | **3.91:1** |
| Pixel studio | “SURFACE ONLY · LOCAL STATE” | 8.6 px | **2.04:1** |
| Pixel studio | gallery meta (“idle · 32×32”) | 7.4 px | **2.60:1** |
| Pixel studio | “CLICK TO LOAD →” | 9.3 px | **2.57:1** |
| Pixel studio | “PALETTE Iris #a78bfa” | 9.4 px | **2.99:1** |

   The canvas hint and the status line are functional instructions/feedback, not decoration. The rest are micro-labels that could be made decorative or raised to body-text contrast. For comparison, the main site’s body text measures 5.66–10.07:1 and passes AA comfortably.

2. **The `h1` is announced letter by letter.** Because the typewriter title is split into one `<span>` per character, Chrome’s accessibility tree exposes it as `[ i v a n i l i e v ]`, not “Ivan Iliev”. A screen reader hears the brackets and each letter separately. The visual effect is worth keeping; the accessible name needs to be supplied separately and the decorative spans hidden.

3. **The gallery dialog does not manage focus.** Open any project gallery: focus stays on the trigger button behind the overlay; Tab moves through background page buttons, not the dialog; the close/prev/next buttons are reachable only if you tab far enough. The dialog has `aria-modal="true"` but the background is not inert and focus is never moved in or trapped. Escape and arrow keys work, and the body scroll lock works. This is the main keyboard failure on the site.

4. **Heading hierarchy breaks in the lab, and is flat elsewhere.** `/lab` goes `h1` → `h2 01` → `h3 A creature…` → `h2 02` → `h3 Draw…` → **`h2 Pixel Art Studio`** (the embedded card) → `h3 PLUGIN OUTPUT` → `h2 03`. The embedded card’s `h2` is a sub-part of section 02 and should not be a peer of it. Project and play pages have only an `h1`; the long descriptions have no sections to navigate.

5. **Gallery alt text is generic.** The BeaverWize buttons are named “BeaverWize screenshot 1” … “screenshot 7” and “clip 2”; the modal image is “Gallery image 1”. The screenshots are the only proof of that project, and the alt text describes the file, not the content. The `/projects` card posters use `alt=""` (acceptable as decorative, but it means the visual proof is lost to screen-reader users), while `/play` and the launch images have genuinely descriptive alt text — so the team knows how to do it.

6. **The BeaverWize clip has no text alternative** beyond “clip 2”; it is a silent screen recording, so captions are not the issue, but the content of the clip is not described anywhere.

7. **Restart buttons do nothing.** After launching, the button changes to “restart the pond” / “restart” / “restart the dragons”, but clicking it does not reload or reset the iframe (verified: the iframe element and its `src` are unchanged). This is a functional bug, and it makes the page’s most prominent control a lie.

8. **Dragons is mouse-only.** The page is honest about it, and a path-dependent flying game arguably falls under the WCAG keyboard exception, but a keyboard-only visitor cannot play the archived game. That is acceptable for a 2015 relic if the site says so; it does.

## 7. Changes that would move the needle most

These are directions, not replacement copy.

**Positioning and proof**

1. **Make the first screen say what job Ivan wants, not just what he is studying.** Add a role/target line, make the availability badge a route to contact or the CV, and put an email/contact action in the hero. Keep the dry tone; this is a labelling problem, not a tone problem.
2. **Show one piece of work above the fold and give every `/projects` card a real visual.** A single Dewdrop/driftblock frame or a Pip cameo would do more than another sentence. Replace the four tag-only 16:10 panels (ai-f1, Laravel, dsh, portfolio) with screenshots, diagrams or generated stills; the current fallback reads as “missing image”.
3. **Promote the proactive work.** Move dsh-works into “selected work” or the top half of `/projects`, and make its project page open with a link to `/lab`. Today the only action on that page goes to an organisation with no project repositories; the proof is on the same site and unlinked.
4. **Rebuild the project pages as case studies.** Add a meta row (year, solo/team, role, stack, status) and two or three headed sections: what it is, what Ivan did, what was hard, what came of it. Put the primary action (Play / GitHub / See it live) at the top, not after the gallery. This matters most for BeaverWize and Laravel; their current passive team summaries are the weakest evidence on the site.
5. **Give the professional projects whatever proof the NDA allows.** An architecture diagram, anonymised screenshots, a role breakdown, scale numbers, a before/after metric. “I was part of a team” is not a contribution; “I owned the notification service and the Docker setup” is.
6. **Cut or upgrade “this website”.** As a one-line card it is filler and it breaks the count. As a case study of the background renderer, performance work, prerendering and reduced-motion handling, it would be a legitimate project — and would reinforce the tooling/craft story.
7. **Add year/role/status to the list and fix the count.** The page says six and shows seven; the ordering is not self-evident. Either make the portfolio a non-peer note or make the count honest.
8. **Make the CV and contact persistent.** Keep the CV link visible in the mobile nav or footer; add a contact item to the nav or an email action in the hero. On mobile today, a visitor on `/projects` has no CV path at all.
9. **Reconcile the small factual slips.** The driftblock car credit (Mercedes vs Citroën), “one page”, “no trackers” alongside Google Fonts, and the no-op restart buttons. These are small, but they are exactly the details a hiring manager uses to judge “ships carefully”.

**Accessibility**

10. **Raise the lab microtext to readable contrast and size** (the table above), or make the labels decorative and put the same information in body text. The canvas hint and status line are functional; they cannot stay at 2.9:1 and 3.9:1.
11. **Give the `h1` a clean accessible name** and hide the per-character spans from the accessibility tree. The visual typewriter effect can stay.
12. **Manage focus in the gallery dialog:** move focus to the close button (or the dialog) on open, trap Tab inside, mark the background inert, and restore focus to the trigger on close.
13. **Make gallery alt text describe the screenshot**, not its index, and add a short text description for the BeaverWize clip.

## Plainly

The site is not short on talent or evidence; it is short on framing. Ivan’s best proof is a working lab that most visitors will never reach, his two professional projects are the least specific pages he has, and the site never says the word “developer”. Fix the work list and the two team-project pages, promote the tooling, and the site will read as what it actually is: a 22-year-old who has been building since he was eight and ships real things. Keep the dry voice — it is the most credible thing here.
