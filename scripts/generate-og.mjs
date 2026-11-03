#!/usr/bin/env node
/**
 * generate-og.mjs — social cards and app icons, rendered from HTML with the same chromium
 * the bench scripts use.
 *
 * Outputs (all committed, so the build never needs a browser):
 *   static/og/<slug>.png          1200x630, one per page and per project
 *   static/icon-192.png            manifest icon
 *   static/icon-512.png            manifest icon
 *   static/apple-touch-icon.png    180x180, iOS home screen
 *
 * Usage:
 *   node scripts/generate-og.mjs            # write everything
 *   node scripts/generate-og.mjs --check    # exit 1 if a card is missing, write nothing
 *
 * The project list below is duplicated from `src/lib/data/projects.ts` on purpose — this
 * script must run without TypeScript — and it verifies the ids still match, so adding a
 * project and forgetting its card fails loudly instead of silently shipping no preview.
 */

import { createRequire } from 'node:module';
import { mkdir, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLAYWRIGHT_CORE =
	process.env.PLAYWRIGHT_CORE ??
	'C:\\Users\\IvanIlievImkershop\\Documents\\deepseek-harness\\.scratch\\node_modules\\playwright-core';
const CHROME_PATH =
	process.env.CHROME_PATH ??
	'C:\\Users\\IvanIlievImkershop\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

/** Every card this site should have. `slug` matches static/og/<slug>.png. */
const CARDS = [
	{
		slug: 'home',
		eyebrow: 'portfolio · 2026',
		title: 'browser games, a pixel-art pond, and tooling I use every day',
		subtitle: 'ICT student at HZ University of Applied Sciences, Vlissingen',
		path: '/'
	},
	{
		slug: 'work',
		eyebrow: 'work',
		title: 'six projects, from a pond to a racing AI',
		subtitle: 'driftblock · Dewdrop Bend · ai-f1-racing · BeaverWize · Laravel · the lab',
		path: '/projects'
	},
	{
		slug: 'lab',
		eyebrow: 'the lab',
		title: 'private repositories, public proof',
		subtitle: 'Pip, the pixel-art surface and the alerts bell — running, not screenshotted',
		path: '/lab'
	},
	{
		slug: 'play',
		eyebrow: 'play',
		title: 'two small worlds and one relic',
		subtitle: 'Dewdrop Bend · driftblock · Dragons (2015)',
		path: '/play'
	},
	{
		slug: 'dewdrop-bend',
		eyebrow: 'project',
		title: 'Dewdrop Bend',
		subtitle: 'a living pixel-art pond with a 24-hour sky',
		path: '/projects/dewdrop-bend'
	},
	{
		slug: 'driftblock',
		eyebrow: 'project',
		title: 'driftblock',
		subtitle: 'a blocky 3D drift racer with no build step and no assets',
		path: '/projects/driftblock'
	},
	{
		slug: 'ai-f1-racing',
		eyebrow: 'project',
		title: 'ai-f1-racing',
		subtitle: 'a driver trained by evolution on a deterministic 2D sim',
		path: '/projects/ai-f1-racing'
	},
	{
		slug: 'beaverwize',
		eyebrow: 'project',
		title: 'BeaverWize',
		subtitle: 'a gamified water-conservation app on a microservice stack',
		path: '/projects/beaverwize'
	},
	{
		slug: 'laravel-nda',
		eyebrow: 'project',
		title: 'Laravel application',
		subtitle: 'spreadsheets to a role-based workflow, for a steel producer',
		path: '/projects/laravel-nda'
	},
	{
		slug: 'dsh-works',
		eyebrow: 'project',
		title: 'dsh-works plugins',
		subtitle: 'a pixel-art surface, a creature with opinions, an alerts bell',
		path: '/projects/dsh-works'
	},
	{
		slug: 'portfolio',
		eyebrow: 'project',
		title: 'ivaniliev.online',
		subtitle: 'this website — SvelteKit, Tailwind, and a canvas sky',
		path: '/projects/portfolio'
	},
	{
		slug: 'dragons',
		eyebrow: 'archive · 2015',
		title: 'Dragons',
		subtitle: 'the first game I still have, unedited, with a warning label',
		path: '/play/dragons'
	}
];

const ICONS = [
	{ file: 'static/icon-192.png', size: 192 },
	{ file: 'static/icon-512.png', size: 512 },
	{ file: 'static/apple-touch-icon.png', size: 180 }
];

const cardHtml = (card) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background:
      radial-gradient(ellipse 80% 90% at 18% 0%, rgba(167,139,250,0.22), transparent 60%),
      radial-gradient(ellipse 70% 80% at 92% 18%, rgba(236,72,153,0.14), transparent 62%),
      radial-gradient(ellipse 90% 80% at 50% 120%, rgba(56,189,248,0.10), transparent 60%),
      #070912;
    color: #f5f4f1;
    font-family: "Segoe UI", system-ui, sans-serif;
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 68px 76px 60px;
    position: relative; overflow: hidden;
  }
  body::after {
    content: ""; position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.55) 1px, transparent 1.2px);
    background-size: 90px 78px; opacity: 0.30;
  }
  .brand { display: flex; align-items: center; gap: 16px; font-family: Consolas, monospace; }
  .tile {
    width: 46px; height: 46px; border-radius: 9px; display: grid; place-items: center;
    border: 1px solid rgba(167,139,250,0.45); background: rgba(167,139,250,0.16);
    color: #ede9fe; font-size: 19px; letter-spacing: 0.02em;
  }
  .name { font-size: 26px; color: #f3f0ff; letter-spacing: 0.02em; }
  .caret { width: 5px; height: 22px; background: #c4b5fd; box-shadow: 0 0 10px rgba(167,139,250,0.9); }
  .eyebrow {
    font-family: Consolas, monospace; font-size: 20px; letter-spacing: 0.30em;
    text-transform: uppercase; color: rgba(245,244,241,0.55); margin-bottom: 22px;
  }
  h1 { font-size: 74px; line-height: 1.05; font-weight: 600; max-width: 1000px; letter-spacing: -0.02em; }
  .sub { margin-top: 24px; font-size: 27px; color: rgba(245,244,241,0.62); max-width: 900px; line-height: 1.35; }
  .foot { display: flex; align-items: center; gap: 22px; font-family: Consolas, monospace; font-size: 20px; color: rgba(245,244,241,0.45); }
  .rule { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(167,139,250,0.45), transparent); }
</style></head>
<body>
  <div class="brand"><span class="tile">ii</span><span class="name">ivan iliev</span><span class="caret"></span></div>
  <div>
    <div class="eyebrow">${card.eyebrow}</div>
    <h1>${card.title}</h1>
    <p class="sub">${card.subtitle}</p>
  </div>
  <div class="foot"><span>ivaniliev.online${card.path === '/' ? '' : card.path}</span><span class="rule"></span></div>
</body></html>`;

const iconHtml = (size) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; }
  html, body { width: ${size}px; height: ${size}px; }
  body {
    background: radial-gradient(ellipse at 30% 20%, #2b2148 0%, #0e0b18 65%, #070912 100%);
    display: grid; place-items: center; position: relative; overflow: hidden;
  }
  .mark {
    font-family: Consolas, monospace; font-weight: 700;
    font-size: ${Math.round(size * 0.4)}px; letter-spacing: ${Math.round(size * 0.01)}px;
    color: #ede9fe; text-shadow: 0 0 ${Math.round(size * 0.12)}px rgba(167,139,250,0.55);
  }
  .dot {
    position: absolute; width: ${Math.round(size * 0.06)}px; height: ${Math.round(size * 0.06)}px;
    border-radius: 50%; background: #f0b429; right: ${Math.round(size * 0.22)}px; top: ${Math.round(size * 0.24)}px;
    box-shadow: 0 0 ${Math.round(size * 0.05)}px rgba(240,180,41,0.8);
  }
</style></head>
<body><span class="mark">ii</span><span class="dot"></span></body></html>`;

async function projectIds() {
	const source = await readFile(join(ROOT, 'src/lib/data/projects.ts'), 'utf8');
	return [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]);
}

async function main() {
	const checkOnly = process.argv.includes('--check');
	const { chromium } = require(PLAYWRIGHT_CORE);

	const ids = await projectIds();
	const cardSlugs = new Set(CARDS.map((c) => c.slug));
	const missing = ids.filter((id) => !cardSlugs.has(id));
	if (missing.length && !checkOnly) {
		throw new Error(`projects without an OG card: ${missing.join(', ')} — add them to CARDS`);
	}

	if (checkOnly) {
		let failed = false;
		for (const card of CARDS) {
			try {
				await access(join(ROOT, 'static/og', `${card.slug}.png`));
			} catch {
				console.error(`missing: static/og/${card.slug}.png`);
				failed = true;
			}
		}
		for (const icon of ICONS) {
			try {
				await access(join(ROOT, icon.file));
			} catch {
				console.error(`missing: ${icon.file}`);
				failed = true;
			}
		}
		if (missing.length) {
			console.error(`cards out of sync with projects.ts: ${missing.join(', ')}`);
			failed = true;
		}
		process.exit(failed ? 1 : 0);
	}

	const browser = await chromium.launch({ executablePath: CHROME_PATH });
	const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

	await mkdir(join(ROOT, 'static/og'), { recursive: true });

	for (const card of CARDS) {
		await page.setViewportSize({ width: 1200, height: 630 });
		await page.setContent(cardHtml(card), { waitUntil: 'load' });
		await page.screenshot({ path: join(ROOT, 'static/og', `${card.slug}.png`) });
		console.log(`og/${card.slug}.png`);
	}

	for (const icon of ICONS) {
		await page.setViewportSize({ width: icon.size, height: icon.size });
		await page.setContent(iconHtml(icon.size), { waitUntil: 'load' });
		await page.screenshot({ path: join(ROOT, icon.file), omitBackground: false });
		console.log(icon.file);
	}

	await browser.close();
}

main().catch((error) => {
	console.error(error.message ?? error);
	process.exit(1);
});
