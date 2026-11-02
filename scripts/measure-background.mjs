#!/usr/bin/env node
/**
 * measure-background.mjs — repeatable frame-pacing + main-thread measurements for
 * the animated page background.
 *
 * What it does, per fixed scenario:
 *   1. launches the locally installed chromium through playwright-core,
 *   2. loads the page, waits for the background and a fixed settle window,
 *   3. samples requestAnimationFrame deltas for 5 s while sweeping the pointer,
 *   4. brackets that window with CDP Performance.getMetrics reads,
 *   5. counts the DOM the background owns.
 *
 * Fixed matrix (order is part of the contract — do not reorder):
 *   - 1280x900  DPR 1
 *   - 390x844   DPR 3
 *   - 1280x900  DPR 1, prefers-reduced-motion: reduce
 *
 * Usage:
 *   node scripts/measure-background.mjs
 *   node scripts/measure-background.mjs --url http://127.0.0.1:5212/ --json out/measure.json
 *
 * Diagnostics (not part of the standard matrix):
 *   --no-pointer        skip the pointer sweep to reproduce the review's idle baseline
 *   --headed            show the browser window (timings will be less stable)
 *
 * No dependencies beyond playwright-core (path configurable, see below).
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const DEFAULT_URL = 'http://127.0.0.1:5212/';
const DEFAULT_PLAYWRIGHT_CORE =
	process.env.PLAYWRIGHT_CORE ??
	'C:\\Users\\IvanIlievImkershop\\Documents\\deepseek-harness\\.scratch\\node_modules\\playwright-core';
const DEFAULT_CHROME =
	process.env.CHROME_PATH ??
	'C:\\Users\\IvanIlievImkershop\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe';

const SAMPLE_MS = 5000;
const SETTLE_MS = 1500;
const READY_TIMEOUT_MS = 8000;
const POINTER_INTERVAL_MS = 50;
const POINTER_STOP_BEFORE_SAMPLE_END_MS = 150;

/** The matrix is fixed; it is the unit of comparison. */
const SCENARIOS = [
	{
		id: 'desktop',
		label: '1280x900 dpr1',
		width: 1280,
		height: 900,
		dpr: 1,
		reducedMotion: false
	},
	{
		id: 'phone',
		label: '390x844 dpr3',
		width: 390,
		height: 844,
		dpr: 3,
		reducedMotion: false
	},
	{
		id: 'reduced-motion',
		label: '1280x900 dpr1 reduced',
		width: 1280,
		height: 900,
		dpr: 1,
		reducedMotion: true
	}
];

/** Chromium flags that make headless timing less dependent on focus/occlusion. */
const LAUNCH_ARGS = [
	'--disable-background-timer-throttling',
	'--disable-backgrounding-occluded-windows',
	'--disable-renderer-backgrounding',
	'--disable-features=CalculateNativeWinOcclusion',
	'--no-first-run',
	'--no-default-browser-check'
];

function usage() {
	return `usage: node scripts/measure-background.mjs [options]

  --url <url>               page to measure (default ${DEFAULT_URL})
  --json <path>             write a machine-readable result file
  --headed                  run headful (less repeatable)
  --no-pointer              diagnostic: skip the pointer sweep
  --playwright-core <dir>   playwright-core package directory
  --chrome <path>           chromium executable
  -h, --help                show this help
`;
}

function parseArgs(argv) {
	const opts = {
		url: DEFAULT_URL,
		json: null,
		headed: false,
		pointer: true,
		playwrightCore: DEFAULT_PLAYWRIGHT_CORE,
		chrome: DEFAULT_CHROME
	};

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
			case '--json':
				opts.json = next();
				break;
			case '--headed':
				opts.headed = true;
				break;
			case '--no-pointer':
				opts.pointer = false;
				break;
			case '--playwright-core':
				opts.playwrightCore = next();
				break;
			case '--chrome':
				opts.chrome = next();
				break;
			case '-h':
			case '--help':
				process.stdout.write(usage());
				process.exit(0);
				break;
			default:
				throw new Error(`unknown option: ${arg}`);
		}
	}

	return opts;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadPlaywright(packageDir) {
	const entry = path.join(packageDir, 'index.mjs');
	return import(pathToFileURL(entry).href);
}

/**
 * Hash the background implementation so a result file can be tied to a source
 * state. If the rewrite lands mid-run we can tell instead of silently comparing
 * numbers from two different implementations.
 */
async function sourceFingerprint() {
	const files = ['src/lib/components/InteractiveBackground.svelte', 'src/lib/constants.ts'];
	const bgDir = path.join(REPO_ROOT, 'src/lib/background');
	try {
		const entries = await readdir(bgDir);
		for (const name of entries.sort()) {
			if (name.endsWith('.ts') || name.endsWith('.js')) files.push(`src/lib/background/${name}`);
		}
	} catch {
		// directory does not exist (pre-rewrite)
	}

	const hash = createHash('sha256');
	const found = [];
	for (const rel of files) {
		try {
			const body = await readFile(path.join(REPO_ROOT, rel));
			hash.update(rel);
			hash.update('\0');
			hash.update(body);
			hash.update('\0');
			found.push(rel);
		} catch {
			// file not present in this implementation
		}
	}

	return { hash: hash.digest('hex').slice(0, 16), files: found };
}

/** Linear-interpolation percentile (R-7), same method as most timing tools. */
function percentile(sorted, p) {
	if (sorted.length === 0) return null;
	if (sorted.length === 1) return sorted[0];
	const index = (sorted.length - 1) * p;
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function frameStats(deltas) {
	const sorted = [...deltas].sort((a, b) => a - b);
	const total = deltas.reduce((sum, value) => sum + value, 0);
	return {
		frames: deltas.length,
		mean: deltas.length ? total / deltas.length : null,
		p50: percentile(sorted, 0.5),
		p95: percentile(sorted, 0.95),
		max: sorted.length ? sorted[sorted.length - 1] : null,
		over16_7: deltas.filter((value) => value > 16.7).length,
		over33: deltas.filter((value) => value > 33).length
	};
}

/** Returns a frame-delta array; first delta is discarded (not a real interval). */
function sampleFrames(page, durationMs) {
	return page.evaluate(
		(duration) =>
			new Promise((resolve) => {
				const deltas = [];
				let start = null;
				let last = null;

				function frame(now) {
					if (start === null) {
						start = now;
						last = now;
					} else {
						deltas.push(now - last);
						last = now;
					}

					if (now - start < duration) requestAnimationFrame(frame);
					else resolve(deltas);
				}

				requestAnimationFrame(frame);
			}),
		durationMs
	);
}

/**
 * Sweep the pointer across the viewport for most of the sample so parallax,
 * star activation and constellation lines are exercised. Ends slightly before
 * the frame sample so the metrics window does not grow a pointer-move tail.
 */
async function sweepPointer(page, width, height, stopAt) {
	let moves = 0;
	while (Date.now() < stopAt) {
		const elapsed = SAMPLE_MS - (stopAt - Date.now());
		const t = Math.min(1, Math.max(0, elapsed / SAMPLE_MS));
		const x = Math.round(width * (0.1 + 0.8 * t));
		const y = Math.round(height * (0.5 + 0.3 * Math.sin(t * Math.PI * 2)));
		await page.mouse.move(x, y);
		moves++;
		await sleep(POINTER_INTERVAL_MS);
	}
	return moves;
}

async function readMetrics(cdp) {
	const { metrics } = await cdp.send('Performance.getMetrics');
	const map = new Map();
	for (const metric of metrics) map.set(metric.name, metric.value);
	return map;
}

function metricDelta(start, end, name) {
	const before = start.get(name);
	const after = end.get(name);
	if (typeof before !== 'number' || typeof after !== 'number') return null;
	return after - before;
}

function counter(start, end, name) {
	return {
		start: start.get(name) ?? null,
		end: end.get(name) ?? null,
		delta: metricDelta(start, end, name)
	};
}

async function measureScenario(browser, scenario, opts, sourceBefore) {
	const context = await browser.newContext({
		viewport: { width: scenario.width, height: scenario.height },
		deviceScaleFactor: scenario.dpr,
		reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference'
	});

	const page = await context.newPage();
	const pageErrors = [];
	page.on('pageerror', (error) => pageErrors.push(error.message));

	const startedAt = new Date().toISOString();
	await page.goto(opts.url, { waitUntil: 'load', timeout: 30000 });
	await page.waitForSelector('.interactive-background', {
		state: 'attached',
		timeout: READY_TIMEOUT_MS
	});

	// Wait for the scene (DOM stars, or a canvas in the rewrite) to exist. This is
	// a readiness heuristic only; the sample itself starts after a fixed settle.
	// Under reduced motion the component intentionally paints nothing animated,
	// so there is nothing to wait for — but the layer should still be there.
	let animatedLayer = false;
	if (scenario.reducedMotion) {
		animatedLayer = await page.evaluate(
			() =>
				document.querySelector('.interactive-background canvas, .interactive-background .star') !==
				null
		);
	} else {
		try {
			await page.waitForFunction(
				() => {
					const root = document.querySelector('.interactive-background');
					return (
						!!root &&
						(root.querySelector('canvas') !== null || root.querySelector('.star') !== null)
					);
				},
				undefined,
				{ timeout: READY_TIMEOUT_MS }
			);
			animatedLayer = true;
		} catch {
			animatedLayer = false;
		}
	}

	await sleep(SETTLE_MS);

	const cdp = await context.newCDPSession(page);
	await cdp.send('Performance.enable');

	const metricsStart = await readMetrics(cdp);
	const sampleStarted = Date.now();
	const sampling = sampleFrames(page, SAMPLE_MS);

	let pointerMoves = 0;
	if (opts.pointer) {
		pointerMoves = await sweepPointer(
			page,
			scenario.width,
			scenario.height,
			sampleStarted + SAMPLE_MS - POINTER_STOP_BEFORE_SAMPLE_END_MS
		);
	}

	const deltas = await sampling;
	const metricsEnd = await readMetrics(cdp);

	const dom = await page.evaluate(() => {
		const root = document.querySelector('.interactive-background');
		if (!root) return null;
		const elements = root.querySelectorAll('*');
		return {
			elements: elements.length,
			totalIncludingRoot: elements.length + 1,
			elementsWithStyle: root.querySelectorAll('[style]').length
		};
	});

	await context.close();

	const frames = frameStats(deltas);
	const metricsWindowMs = (metricsEnd.get('Timestamp') - metricsStart.get('Timestamp')) * 1000;
	const metricsWindowSeconds = metricsWindowMs / 1000;
	const taskSeconds = metricDelta(metricsStart, metricsEnd, 'TaskDuration');
	const scriptSeconds = metricDelta(metricsStart, metricsEnd, 'ScriptDuration');
	const layouts = metricDelta(metricsStart, metricsEnd, 'LayoutCount');
	const recalcs = metricDelta(metricsStart, metricsEnd, 'RecalcStyleCount');
	const heapEnd = metricsEnd.get('JSHeapUsedSize') ?? null;

	const result = {
		id: scenario.id,
		label: scenario.label,
		viewport: { width: scenario.width, height: scenario.height },
		deviceScaleFactor: scenario.dpr,
		reducedMotion: scenario.reducedMotion,
		startedAt,
		readiness: { animatedLayer, settleMs: SETTLE_MS },
		frames: {
			...frames,
			sampleMs: SAMPLE_MS,
			// Frame timestamps are page-relative; this is the actual sampled span.
			spanMs: deltas.length ? deltas.reduce((sum, value) => sum + value, 0) : 0,
			fps: frames.frames
				? frames.frames / (deltas.reduce((sum, value) => sum + value, 0) / 1000)
				: 0
		},
		pointerMoves,
		metrics: {
			windowMs: metricsWindowMs,
			TaskDuration: {
				start: metricsStart.get('TaskDuration') ?? null,
				end: metricsEnd.get('TaskDuration') ?? null,
				delta: taskSeconds
			},
			ScriptDuration: {
				start: metricsStart.get('ScriptDuration') ?? null,
				end: metricsEnd.get('ScriptDuration') ?? null,
				delta: scriptSeconds
			},
			LayoutCount: counter(metricsStart, metricsEnd, 'LayoutCount'),
			RecalcStyleCount: counter(metricsStart, metricsEnd, 'RecalcStyleCount'),
			JSHeapUsedSize: {
				start: metricsStart.get('JSHeapUsedSize') ?? null,
				end: heapEnd,
				delta: metricDelta(metricsStart, metricsEnd, 'JSHeapUsedSize')
			}
		},
		derived: {
			mainThreadBusyPct: taskSeconds === null ? null : (taskSeconds / metricsWindowSeconds) * 100,
			scriptPct: scriptSeconds === null ? null : (scriptSeconds / metricsWindowSeconds) * 100,
			layoutsPerFrame: layouts === null || frames.frames === 0 ? null : layouts / frames.frames,
			recalcsPerFrame: recalcs === null || frames.frames === 0 ? null : recalcs / frames.frames,
			layoutsPerSecond: layouts === null ? null : layouts / metricsWindowSeconds,
			recalcsPerSecond: recalcs === null ? null : recalcs / metricsWindowSeconds,
			heapEndMb: heapEnd === null ? null : heapEnd / (1024 * 1024)
		},
		dom,
		pageErrors
	};

	// The source can change under a dev server (another agent, an editor). Flag it,
	// do not hide it.
	result.sourceChangedDuringRun = (await sourceFingerprint()).hash !== sourceBefore.hash;
	return result;
}

function fmt(value, digits = 2) {
	return value === null || value === undefined || Number.isNaN(value) ? '-' : value.toFixed(digits);
}

function printTable(rows) {
	const header = ['scenario', 'frames', 'fps', 'mean', 'p50', 'p95', 'max', '>16.7', '>33'];
	const data = rows.map((row) => [
		row.label,
		String(row.frames.frames),
		fmt(row.frames.fps, 1),
		fmt(row.frames.mean),
		fmt(row.frames.p50),
		fmt(row.frames.p95),
		fmt(row.frames.max),
		String(row.frames.over16_7),
		String(row.frames.over33)
	]);

	const widths = header.map((name, index) =>
		Math.max(name.length, ...data.map((line) => line[index].length))
	);
	const line = (cells) =>
		cells
			.map((cell, index) => cell.padEnd(widths[index]))
			.join('  ')
			.trimEnd();

	console.log('\nFrame pacing (rAF deltas, ms)');
	console.log(line(header));
	console.log(widths.map((width) => '-'.repeat(width)).join('  '));
	for (const cells of data) console.log(line(cells));
}

function printMetricsTable(rows) {
	const header = [
		'scenario',
		'window',
		'task s',
		'busy %',
		'script s',
		'layouts',
		'per frame',
		'recalcs',
		'per frame',
		'heap MB',
		'nodes',
		'style attrs'
	];
	const data = rows.map((row) => [
		row.label,
		`${fmt(row.metrics.windowMs / 1000)}s`,
		fmt(row.metrics.TaskDuration.delta),
		fmt(row.derived.mainThreadBusyPct, 1),
		fmt(row.metrics.ScriptDuration.delta),
		String(row.metrics.LayoutCount.delta ?? '-'),
		fmt(row.derived.layoutsPerFrame),
		String(row.metrics.RecalcStyleCount.delta ?? '-'),
		fmt(row.derived.recalcsPerFrame),
		fmt(row.derived.heapEndMb, 1),
		String(row.dom?.elements ?? '-'),
		String(row.dom?.elementsWithStyle ?? '-')
	]);

	const widths = header.map((name, index) =>
		Math.max(name.length, ...data.map((line) => line[index].length))
	);
	const line = (cells) =>
		cells
			.map((cell, index) => cell.padEnd(widths[index]))
			.join('  ')
			.trimEnd();

	console.log('\nMain thread + DOM (CDP Performance deltas over the rAF window)');
	console.log(line(header));
	console.log(widths.map((width) => '-'.repeat(width)).join('  '));
	for (const cells of data) console.log(line(cells));
}

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	opts.url = new URL(opts.url).href;

	const sourceBefore = await sourceFingerprint();
	const playwright = await loadPlaywright(opts.playwrightCore);
	const chromium = playwright.chromium ?? playwright.default?.chromium;
	if (!chromium) throw new Error(`no chromium export in ${opts.playwrightCore}`);

	console.log(`url:        ${opts.url}`);
	console.log(`chrome:     ${opts.chrome}`);
	console.log(`source:     ${sourceBefore.hash} (${sourceBefore.files.length} files)`);
	console.log(
		`sample:     ${SAMPLE_MS} ms after ${SETTLE_MS} ms settle; pointer ${opts.pointer ? 'sweep' : 'idle (diagnostic)'}`
	);
	console.log(`matrix:     ${SCENARIOS.map((scenario) => scenario.label).join(' | ')}`);

	const results = [];
	const warnings = [];
	let chromeVersion = null;

	for (const scenario of SCENARIOS) {
		process.stdout.write(`\n[${scenario.label}] measuring...`);
		// One browser per scenario: renderer counters and the V8 heap start clean,
		// so a scenario cannot inherit the previous one's process state.
		const browser = await chromium.launch({
			executablePath: opts.chrome,
			headless: !opts.headed,
			args: LAUNCH_ARGS
		});
		chromeVersion ??= browser.version();
		try {
			const result = await measureScenario(browser, scenario, opts, sourceBefore);
			results.push(result);
			process.stdout.write(
				` ${result.frames.frames} frames, ${fmt(result.frames.mean)} ms mean, ${fmt(
					result.derived.mainThreadBusyPct,
					1
				)}% busy\n`
			);
		} finally {
			await browser.close();
		}
	}

	const sourceAfter = await sourceFingerprint();
	const sourceChanged = sourceAfter.hash !== sourceBefore.hash;

	for (const result of results) {
		if (!result.reducedMotion && !result.readiness.animatedLayer) {
			warnings.push(
				`${result.label}: no canvas or .star found after load; the page may not have hydrated`
			);
		}
		if (result.frames.frames < 30) {
			warnings.push(`${result.label}: only ${result.frames.frames} frames sampled`);
		}
		if (
			!result.reducedMotion &&
			!result.metrics.LayoutCount.delta &&
			!result.metrics.RecalcStyleCount.delta
		) {
			warnings.push(
				`${result.label}: LayoutCount and RecalcStyleCount are both 0 — metrics are not being measured`
			);
		}
		if (result.sourceChangedDuringRun) {
			warnings.push(`${result.label}: source changed while this scenario was running`);
		}
		if (result.pageErrors.length) {
			warnings.push(`${result.label}: page errors — ${result.pageErrors.join('; ')}`);
		}
	}
	if (sourceChanged) {
		warnings.push(
			`source fingerprint changed during the run: ${sourceBefore.hash} -> ${sourceAfter.hash}; compare rows with care`
		);
	}

	printTable(results);
	printMetricsTable(results);

	if (warnings.length) {
		console.log('\nwarnings');
		for (const warning of warnings) console.log(`  - ${warning}`);
	}

	const payload = {
		tool: 'measure-background',
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		url: opts.url,
		chrome: chromeVersion ?? 'unknown',
		node: process.version,
		platform: `${process.platform} ${process.arch}`,
		settings: {
			sampleMs: SAMPLE_MS,
			settleMs: SETTLE_MS,
			readinessTimeoutMs: READY_TIMEOUT_MS,
			pointerSweep: opts.pointer,
			pointerIntervalMs: POINTER_INTERVAL_MS,
			matrix: SCENARIOS
		},
		source: { before: sourceBefore, after: sourceAfter, changedDuringRun: sourceChanged },
		scenarios: results,
		warnings
	};

	if (opts.json) {
		const target = path.resolve(process.cwd(), opts.json);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
		console.log(`\njson: ${target}`);
	}

	// A matrix measured across a source edit is not one implementation.
	if (sourceChanged) process.exitCode = 1;
}

main().catch((error) => {
	const text = String(error?.stack ?? error);
	console.error(`\nmeasure-background failed: ${text}`);
	if (text.includes('Execution context was destroyed')) {
		console.error(
			'\nhint: the page navigated while a row was running — almost always a dev-server HMR reload after a source edit. Wait for edits to settle, then re-run.'
		);
	}
	process.exitCode = 1;
});
