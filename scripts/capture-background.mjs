#!/usr/bin/env node
/**
 * capture-background.mjs — deterministic screenshots + a browser-decoded pixel diff.
 *
 * Capture mode (default):
 *   Writes one PNG per viewport into the output directory:
 *     1280x900-dpr1.png
 *     390x844-dpr3.png
 *
 * The background is random and time-driven, so two naive screenshots of the same
 * code never match. To make the comparison about code rather than luck, each page
 * is loaded with three deterministic controls injected before the app runs:
 *   - Math.random is a fixed-seed PRNG (same scene layout every run),
 *   - requestAnimationFrame is queued, so the harness (not the browser clock)
 *     decides how many frames the scene has advanced,
 *   - CSS animations/transitions are disabled, so their phase cannot leak in.
 * After a 3 s load warm-up the pointer is parked at a fixed point, the clock is
 * fixed, and exactly 180 frames (3 s at 60 Hz) are advanced before the shot.
 *
 * Diff mode:
 *   node scripts/capture-background.mjs --diff bg-shots/before bg-shots/after
 *   Decodes every matching PNG pair in the browser itself (file:// + canvas) and
 *   reports the mean absolute pixel difference and the share of pixels whose
 *   largest RGB channel difference is greater than 8/255. No image dependency.
 *
 * Usage:
 *   node scripts/capture-background.mjs [outputDir]
 *   node scripts/capture-background.mjs out/before
 *   node scripts/capture-background.mjs --diff out/before out/after
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const DEFAULT_URL = 'http://127.0.0.1:5212/';
const DEFAULT_OUT = './bg-shots';
const DEFAULT_PLAYWRIGHT_CORE =
	process.env.PLAYWRIGHT_CORE ??
	'C:\\Users\\IvanIlievImkershop\\Documents\\deepseek-harness\\.scratch\\node_modules\\playwright-core';
const DEFAULT_CHROME =
	process.env.CHROME_PATH ??
	'C:\\Users\\IvanIlievImkershop\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const WARMUP_MS = 3000;
const FRAME_COUNT = 180;
const FRAME_MS = 1000 / 60;
/** Fixed pointer parking spot, as a fraction of the viewport. */
const PARK = { x: 0.72, y: 0.68 };
const DIFF_THRESHOLD = 8;

const VIEWPORTS = [
	{ id: '1280x900-dpr1', width: 1280, height: 900, dpr: 1 },
	{ id: '390x844-dpr3', width: 390, height: 844, dpr: 3 }
];

const LAUNCH_ARGS = [
	'--disable-background-timer-throttling',
	'--disable-backgrounding-occluded-windows',
	'--disable-renderer-backgrounding',
	'--disable-features=CalculateNativeWinOcclusion',
	'--no-first-run',
	'--no-default-browser-check'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function usage() {
	return `usage:
  node scripts/capture-background.mjs [options] [outputDir]

capture options:
  --url <url>               page to capture (default ${DEFAULT_URL})
  --out <dir>               output directory (default ${DEFAULT_OUT})
  --headed                  run headful
  --playwright-core <dir>   playwright-core package directory
  --chrome <path>           chromium executable

diff options:
  --diff <dirA> <dirB>      compare matching PNGs in two capture directories

  -h, --help                show this help
`;
}

function parseArgs(argv) {
	const opts = {
		url: DEFAULT_URL,
		out: null,
		headed: false,
		diff: null,
		playwrightCore: DEFAULT_PLAYWRIGHT_CORE,
		chrome: DEFAULT_CHROME,
		showHelp: false
	};
	const positional = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => {
			const value = argv[++i];
			if (value === undefined) throw new Error(`missing value for ${arg}`);
			return value;
		};

		switch (arg) {
			case '--url':
				opts.url = next();
				break;
			case '--out':
				opts.out = next();
				break;
			case '--headed':
				opts.headed = true;
				break;
			case '--diff':
				opts.diff = [next(), next()];
				break;
			case '--playwright-core':
				opts.playwrightCore = next();
				break;
			case '--chrome':
				opts.chrome = next();
				break;
			case '-h':
			case '--help':
				opts.showHelp = true;
				break;
			default:
				if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
				positional.push(arg);
		}
	}

	if (!opts.out && positional.length > 0) opts.out = positional[0];
	if (positional.length > 1)
		throw new Error(`unexpected arguments: ${positional.slice(1).join(' ')}`);
	opts.out ??= DEFAULT_OUT;
	return opts;
}

async function loadPlaywright(packageDir) {
	return import(pathToFileURL(path.join(packageDir, 'index.mjs')).href);
}

async function sourceFingerprint() {
	const files = ['src/lib/components/InteractiveBackground.svelte', 'src/lib/constants.ts'];
	const bgDir = path.join(REPO_ROOT, 'src/lib/background');
	try {
		for (const name of (await readdir(bgDir)).sort()) {
			if (name.endsWith('.ts') || name.endsWith('.js')) files.push(`src/lib/background/${name}`);
		}
	} catch {
		// pre-rewrite
	}

	const hash = createHash('sha256');
	const found = [];
	for (const rel of files) {
		try {
			hash.update(rel);
			hash.update('\0');
			hash.update(await readFile(path.join(REPO_ROOT, rel)));
			hash.update('\0');
			found.push(rel);
		} catch {
			// not present
		}
	}
	return { hash: hash.digest('hex').slice(0, 16), files: found };
}

/**
 * Runs before any page script. Keeps the page loadable (timers still run) while
 * removing the three sources of run-to-run variation.
 */
function installDeterminism() {
	// Mulberry32, fixed seed. Only the distribution matters to the app.
	let state = 0x9e3779b9 >>> 0;
	Math.random = () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	// Freeze CSS animation/transition phase at the base style. Pausing would leave
	// reveal animations stuck at opacity 0; removing them shows the final style.
	const css = '*,*::before,*::after{animation:none !important;transition:none !important;}';
	const inject = () => {
		if (!document.documentElement) return false;
		const style = document.createElement('style');
		style.textContent = css;
		document.documentElement.appendChild(style);
		return true;
	};
	if (!inject()) {
		const observer = new MutationObserver(() => {
			if (inject()) observer.disconnect();
		});
		observer.observe(document, { childList: true, subtree: true });
	}

	// rAF is driven by the harness. Callbacks are queued, never run by the browser,
	// so the number of elapsed frames is exactly the number we choose.
	window.__bench = { queue: [], nextId: 1, now: 0, frames: 0 };
	window.requestAnimationFrame = (callback) => {
		const id = window.__bench.nextId++;
		window.__bench.queue.push({ id, callback });
		return id;
	};
	window.cancelAnimationFrame = (id) => {
		window.__bench.queue = window.__bench.queue.filter((entry) => entry.id !== id);
	};
}

/**
 * Hash what the dev server actually serves for the background modules. The disk
 * fingerprint cannot see a stale Vite transform, and on a shared working tree
 * that is a real failure mode. Two captures with different served hashes are not
 * a fair pixel comparison, which is exactly what this field makes visible.
 */
async function servedSourceHash(page, url) {
	const paths = [
		'/src/lib/components/InteractiveBackground.svelte',
		'/src/lib/constants.ts',
		'/src/lib/background/scene.ts',
		'/src/lib/background/sprites.ts',
		'/src/lib/background/render.ts'
	];
	const hash = createHash('sha256');
	const served = [];
	for (const rel of paths) {
		try {
			const response = await page.request.get(new URL(rel, url).href);
			if (!response.ok()) continue;
			hash.update(rel);
			hash.update('\0');
			hash.update(await response.text());
			hash.update('\0');
			served.push(rel);
		} catch {
			// not part of this implementation
		}
	}
	return { hash: hash.digest('hex').slice(0, 16), files: served };
}

async function captureViewport(browser, url, viewport, outDir) {
	const context = await browser.newContext({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: viewport.dpr
	});
	await context.addInitScript(installDeterminism);

	const page = await context.newPage();
	await page.goto(url, { waitUntil: 'load', timeout: 30000 });
	await page.waitForSelector('.interactive-background', {
		state: 'attached',
		timeout: 15000
	});
	const served = await servedSourceHash(page, url);

	// Let the scene hydrate and the sprites bake. rAF is frozen, so this is a
	// load/settle window, not animation time.
	await sleep(WARMUP_MS);
	await page.evaluate(() => document.fonts.ready);

	// A component that starts its loop on a timeout (the usual pattern) should have
	// queued its first callback by now. Waiting closes the "started late, so only N
	// of the 180 frames ran" hole; a component that waits for a native frame
	// before starting simply misses this and still gets driven below.
	let loopReady = false;
	try {
		await page.waitForFunction(() => window.__bench.queue.length > 0, undefined, {
			timeout: 3000
		});
		loopReady = true;
	} catch {
		loopReady = false;
	}

	const park = {
		x: Math.round(viewport.width * PARK.x),
		y: Math.round(viewport.height * PARK.y)
	};

	// Fix the page clock before parking: activation timestamps become 0 for every
	// run. The frame loop below advances the same clock explicitly.
	await page.evaluate(() => {
		window.__bench.now = 0;
		performance.now = () => window.__bench.now;
	});
	await page.mouse.move(park.x, park.y);

	const driven = await page.evaluate(
		async ({ frameCount, frameMs }) => {
			const bench = window.__bench;
			const queuedBefore = bench.queue.length;
			let callbacksRun = 0;
			for (let i = 0; i < frameCount; i++) {
				bench.now += frameMs;
				const due = bench.queue;
				bench.queue = [];
				for (const entry of due) {
					entry.callback(bench.now);
					callbacksRun++;
				}
				bench.frames++;
				// Give microtasks and async mount work a chance between frames, so a
				// component that awaits layout still starts its loop deterministically.
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
			return {
				frames: bench.frames,
				queuedBefore,
				queued: bench.queue.length,
				callbacksRun,
				now: bench.now
			};
		},
		{ frameCount: FRAME_COUNT, frameMs: FRAME_MS }
	);

	// Let Svelte flush its final DOM update (and any final promises settle) before
	// the screenshot. No frame is advanced in this wait.
	await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
	await page.evaluate(() => document.fonts.ready);

	const file = `${viewport.id}.png`;
	const target = path.join(outDir, file);
	const buffer = await page.screenshot({ type: 'png' });
	await writeFile(target, buffer);

	await context.close();

	return {
		file,
		width: viewport.width,
		height: viewport.height,
		dpr: viewport.dpr,
		park,
		loopReady,
		framesAdvanced: driven.frames,
		callbacksRun: driven.callbacksRun,
		queuedBefore: driven.queuedBefore,
		queuedCallbacksLeft: driven.queued,
		virtualTimeMs: driven.now,
		servedSourceHash: served.hash,
		sha256: createHash('sha256').update(buffer).digest('hex'),
		bytes: buffer.length
	};
}

async function runCapture(opts) {
	const playwright = await loadPlaywright(opts.playwrightCore);
	const chromium = playwright.chromium ?? playwright.default?.chromium;
	if (!chromium) throw new Error(`no chromium export in ${opts.playwrightCore}`);

	const outDir = path.resolve(process.cwd(), opts.out);
	await mkdir(outDir, { recursive: true });

	const source = await sourceFingerprint();
	console.log(`url:     ${opts.url}`);
	console.log(`out:     ${outDir}`);
	console.log(`source:  ${source.hash} (${source.files.length} files)`);
	console.log(
		`method:  seeded Math.random, frozen rAF, CSS animations off, ${FRAME_COUNT} frames after ${WARMUP_MS} ms warm-up`
	);

	const browser = await chromium.launch({
		executablePath: opts.chrome,
		headless: !opts.headed,
		args: LAUNCH_ARGS
	});
	const captures = [];
	const warnings = [];
	try {
		const chromeVersion = browser.version();
		for (const viewport of VIEWPORTS) {
			process.stdout.write(`\n[${viewport.id}] capturing...`);
			const capture = await captureViewport(browser, opts.url, viewport, outDir);
			captures.push(capture);
			process.stdout.write(
				` ${capture.file} (${capture.bytes} bytes, served ${capture.servedSourceHash})\n`
			);
		}

		const sourceAfter = await sourceFingerprint();
		const sourceChanged = sourceAfter.hash !== source.hash;
		const servedHashes = new Set(captures.map((capture) => capture.servedSourceHash));
		if (sourceChanged) {
			warnings.push(
				`source changed during capture: ${source.hash} -> ${sourceAfter.hash}; the two viewports may not show the same code`
			);
		}
		if (servedHashes.size > 1) {
			warnings.push(
				`the dev server served different module sets to different viewports (${[
					...servedHashes
				].join(', ')}); re-run once the server has settled`
			);
		}
		if (captures.some((capture) => capture.callbacksRun === 0)) {
			warnings.push(
				'a capture advanced 0 browser callbacks — the background never started animating in that run'
			);
		} else if (captures.some((capture) => capture.callbacksRun < FRAME_COUNT)) {
			warnings.push(
				'a capture advanced fewer callbacks than frames — the animation loop started late; re-run'
			);
		}
		if (captures.some((capture) => !capture.loopReady)) {
			warnings.push(
				'the animation loop was not queued before the frame run; results may be late-start'
			);
		}

		const manifest = {
			tool: 'capture-background',
			schemaVersion: 1,
			generatedAt: new Date().toISOString(),
			url: opts.url,
			chrome: chromeVersion,
			node: process.version,
			platform: `${process.platform} ${process.arch}`,
			source: { ...source, after: sourceAfter, changedDuringRun: sourceChanged },
			determinism: {
				seededRandom: true,
				frozenAnimationFrame: true,
				cssAnimations: 'disabled',
				warmupMs: WARMUP_MS,
				framesAdvanced: FRAME_COUNT,
				frameMs: FRAME_MS,
				parkFraction: PARK
			},
			warnings,
			captures
		};
		await writeFile(path.join(outDir, 'capture.json'), `${JSON.stringify(manifest, null, 2)}\n`);

		console.log('\ncaptured');
		for (const capture of captures) {
			console.log(
				`  ${capture.file.padEnd(20)} ${String(capture.width).padStart(4)}x${String(capture.height).padEnd(4)} dpr${capture.dpr}  sha ${capture.sha256.slice(0, 12)}  callbacks ${capture.callbacksRun}`
			);
		}
		if (warnings.length) {
			console.log('\nwarnings');
			for (const warning of warnings) console.log(`  - ${warning}`);
		}
		// A pair captured across a source/transform change cannot be used as a
		// before/after pair. Write the files (they are useful for diagnosis) but
		// fail the run so a CI or a human does not silently trust it.
		if (sourceChanged || servedHashes.size > 1) {
			process.exitCode = 1;
			console.log(
				'\ncaptures are not a trustworthy pair; re-run after the source/dev server settles'
			);
		}
		console.log(`  manifest: ${path.join(outDir, 'capture.json')}`);
	} finally {
		await browser.close();
	}
}

async function listPngs(dir) {
	try {
		return new Set(
			(await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.png')).sort()
		);
	} catch (error) {
		throw new Error(`cannot read directory ${dir}: ${error.message}`);
	}
}

/**
 * Decode both PNGs in the browser and diff them on a canvas. Keeping the decode
 * in Chromium means no image library and identical colour handling to the shots.
 */
async function diffPair(page, fileA, fileB, threshold) {
	const urlA = pathToFileURL(fileA).href;
	const urlB = pathToFileURL(fileB).href;
	await page.goto(urlA, { waitUntil: 'load' });
	return page.evaluate(
		async ({ a, b, threshold }) => {
			const load = (src) =>
				new Promise((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = () => reject(new Error(`cannot decode ${src}`));
					image.src = src;
				});

			const [imageA, imageB] = await Promise.all([load(a), load(b)]);
			const width = imageA.naturalWidth;
			const height = imageA.naturalHeight;
			if (width !== imageB.naturalWidth || height !== imageB.naturalHeight) {
				return {
					error: 'dimension mismatch',
					a: { width, height },
					b: { width: imageB.naturalWidth, height: imageB.naturalHeight }
				};
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d', { willReadFrequently: true });
			if (!ctx) return { error: 'cannot create 2d context' };

			ctx.drawImage(imageA, 0, 0);
			const dataA = ctx.getImageData(0, 0, width, height).data;
			ctx.clearRect(0, 0, width, height);
			ctx.drawImage(imageB, 0, 0);
			const dataB = ctx.getImageData(0, 0, width, height).data;

			let sum = 0;
			let over = 0;
			let max = 0;
			const pixels = width * height;
			for (let i = 0; i < dataA.length; i += 4) {
				// Screenshots are opaque; compare RGB and take the strongest channel so
				// a colour shift is not diluted by averaging the other two.
				const dr = Math.abs(dataA[i] - dataB[i]);
				const dg = Math.abs(dataA[i + 1] - dataB[i + 1]);
				const db = Math.abs(dataA[i + 2] - dataB[i + 2]);
				const diff = Math.max(dr, dg, db);
				sum += diff;
				if (diff > max) max = diff;
				if (diff > threshold) over++;
			}

			return {
				width,
				height,
				pixels,
				meanAbsDiff: sum / pixels,
				pctAbove: (over / pixels) * 100,
				pixelsAbove: over,
				maxAbsDiff: max
			};
		},
		{ a: urlA, b: urlB, threshold }
	);
}

async function runDiff(opts) {
	const [dirA, dirB] = opts.diff.map((dir) => path.resolve(process.cwd(), dir));
	const namesA = await listPngs(dirA);
	const namesB = await listPngs(dirB);
	const shared = [...namesA].filter((name) => namesB.has(name)).sort();

	console.log(`A: ${dirA}`);
	console.log(`B: ${dirB}`);

	if (shared.length === 0) {
		throw new Error('no matching .png files in the two directories');
	}

	const onlyA = [...namesA].filter((name) => !namesB.has(name));
	const onlyB = [...namesB].filter((name) => !namesA.has(name));

	const playwright = await loadPlaywright(opts.playwrightCore);
	const chromium = playwright.chromium ?? playwright.default?.chromium;
	const browser = await chromium.launch({
		executablePath: opts.chrome,
		headless: !opts.headed,
		// file:// pages need this to read a second file:// image into a canvas.
		args: [...LAUNCH_ARGS, '--allow-file-access-from-files']
	});

	const rows = [];
	let failures = 0;
	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		for (const name of shared) {
			const fileA = path.join(dirA, name);
			const fileB = path.join(dirB, name);
			process.stdout.write(`\n[${name}] decoding...`);
			const result = await diffPair(page, fileA, fileB, DIFF_THRESHOLD);
			if (result.error) {
				failures++;
				rows.push({
					name,
					error: result.error,
					detail: `${result.a?.width}x${result.a?.height} vs ${result.b?.width}x${result.b?.height}`
				});
				process.stdout.write(` ${result.error}\n`);
			} else {
				rows.push({ name, ...result });
				process.stdout.write(
					` mean ${result.meanAbsDiff.toFixed(3)}/255, ${result.pctAbove.toFixed(2)}% > ${DIFF_THRESHOLD}/255\n`
				);
			}
		}
		await context.close();
	} finally {
		await browser.close();
	}

	const header = ['file', 'size', 'mean abs', '% > 8/255', 'max', 'pixels > 8'];
	const data = rows.map((row) => {
		if (row.error) return [row.name, row.detail ?? row.error, '-', '-', '-', '-'];
		return [
			row.name,
			`${row.width}x${row.height}`,
			row.meanAbsDiff.toFixed(3),
			`${row.pctAbove.toFixed(2)}%`,
			String(row.maxAbsDiff),
			String(row.pixelsAbove)
		];
	});
	const widths = header.map((name, index) =>
		Math.max(name.length, ...data.map((line) => line[index].length))
	);
	const line = (cells) =>
		cells
			.map((cell, index) => cell.padEnd(widths[index]))
			.join('  ')
			.trimEnd();

	console.log('\nPixel diff (largest RGB channel per pixel)');
	console.log(line(header));
	console.log(widths.map((width) => '-'.repeat(width)).join('  '));
	for (const cells of data) console.log(line(cells));

	const valid = rows.filter((row) => !row.error);
	if (valid.length > 0) {
		const pixels = valid.reduce((sum, row) => sum + row.pixels, 0);
		const weightedMean = valid.reduce((sum, row) => sum + row.meanAbsDiff * row.pixels, 0) / pixels;
		const weightedPct =
			(valid.reduce((sum, row) => sum + (row.pctAbove / 100) * row.pixels, 0) / pixels) * 100;
		console.log(
			`\nall files: mean ${weightedMean.toFixed(3)}/255, ${weightedPct.toFixed(2)}% of pixels > ${DIFF_THRESHOLD}/255`
		);
	}

	if (onlyA.length) console.log(`\nonly in A: ${onlyA.join(', ')}`);
	if (onlyB.length) console.log(`only in B: ${onlyB.join(', ')}`);

	if (failures > 0) {
		throw new Error(`${failures} file(s) could not be compared`);
	}
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	if (opts.showHelp) {
		process.stdout.write(usage());
		return;
	}
	opts.url = new URL(opts.url).href;
	if (opts.diff) await runDiff(opts);
	else await runCapture(opts);
}

main().catch((error) => {
	const text = String(error?.stack ?? error);
	console.error(`\ncapture-background failed: ${text}`);
	if (text.includes('Execution context was destroyed')) {
		console.error(
			'\nhint: the page navigated while a capture was running — almost always a dev-server HMR reload after a source edit. Wait for edits to settle, then re-run.'
		);
	}
	process.exitCode = 1;
});
