# Rebuild v2 — ivaniliev.online

A refresh of the portfolio: same idea (a galaxy-ish, quiet, hand-built site), rebuilt around the
work rather than the animation.

## Why

The 2025 version was a hero and a project list. It said "ICT student" and stopped. Since then the
work changed: two of the projects are games, one is a trained AI, and most of the daily building
happens in private repositories for a coding agent — none of which the site showed.

## What changed

**Structure.** A real page shell: sticky navigation, a footer with contact, and four routes.

| route | what it is |
| --- | --- |
| `/` | hero, selected work, lab teaser, how it got here, contact |
| `/projects` | the full list, deep-linkable per project (`#driftblock`) |
| `/lab` | the private work, shown running instead of described |
| `/play/driftblock` | the game on this domain, launched on click |

**The lab.** Repositories for the DeepSeek Harness plugins stay private, so the *work* is public
instead: the real Pip sprite sheets playing on their real frame timings, a working 32×32 pixel-art
editor with the plugin's palette and PNG export, and a mock of the alerts toast with the numbers it
reports. Nothing is faked with screenshots of a repository nobody can open.

**Growth.** A four-step timeline (2021 coursework → 2023 team projects → 2025 BeaverWize and the
NDA Laravel application → 2026 games and tooling). It replaces adjectives with dates.

**Design.** Same palette and the same typewriter title, tightened: a status line instead of a
headline about being a student, an editorial list of selected work instead of card clutter,
consistent card treatment, calmer motion.

**Performance.**

- Screenshots converted to WebP: 1.1 MB → 206 KB across the gallery.
- The game loads nothing until you press play (28 MB of three.js, meshes and audio).
- The animated background only runs where it earns its keep, and stops on a hidden tab.
- Sitemap, per-page Open Graph tags, `theme-color`, a skip link, and `prefers-reduced-motion`
  respected throughout.

## Hosting the games

`driftblock` stays on GitHub Pages and is embedded on `/play/driftblock`: its runtime payload is
about 28 MB, which is too much to vendor into this repository. The page is on the site's own
domain, launches on click and can go fullscreen. If the game ever needs to be served from
`ivaniliev.online` directly, the right move is a subdomain (for example `games.ivaniliev.online`)
pointed at a separate deployment, not a copy inside this repo.

## Not done

- No dark/light switch: the site is dark on purpose.
- No blog. The lab is the writing.
- The `@dsh-works` plugins themselves are unchanged; only their presentation is new.
