<script lang="ts">
	import { onMount } from 'svelte';
	import { INTERACTIVE_BACKGROUND as BG } from '$lib/constants';
	import {
		activateStars,
		createScene,
		resizeScene,
		updateConnections,
		updateScene,
		type Scene
	} from '$lib/background/scene';
	import {
		createAuroraSprite,
		createSceneSprites,
		type SceneSprites,
		type Sprite
	} from '$lib/background/sprites';
	import { renderScene, type BackgroundWeights } from '$lib/background/render';

	interface Props {
		enableStars?: boolean;
		enableClouds?: boolean;
		enableParticles?: boolean;
		enableAurora?: boolean;
		starCount?: number;
		particleCount?: number;
		cloudCount?: number;
	}

	let {
		enableStars = true,
		enableClouds = false,
		enableParticles = true,
		enableAurora = true,
		starCount = BG.stars.count,
		particleCount = BG.particles.count,
		cloudCount = BG.clouds.count
	}: Props = $props();

	let container: HTMLDivElement | null = null;
	let canvas: HTMLCanvasElement | null = null;

	const FRAME_MS = 1000 / 60;
	const TIERS = BG.quality.tiers;
	const LAST_TIER = TIERS.length - 1;

	let ctx: CanvasRenderingContext2D | null = null;
	let scene: Scene | null = null;
	let sprites: SceneSprites | null = null;
	let aurora: Sprite | null = null;

	let width = 0;
	let height = 0;
	let dpr = 1;

	let rafId = 0;
	let running = false;
	let destroyed = false;
	let reduced = false;
	let startTimer = 0;
	let resizeTimer = 0;

	let lastFrame = 0;
	let elapsed = 0;
	let tier = 0;
	let framesSinceTier = 0;
	let sampleIndex = 0;
	let sampleCount = 0;
	const frameTimes = new Float32Array(BG.quality.sampleFrames);

	/** 1 = fully on, 0 = dropped. Eased, so a quality drop never pops. */
	const weights: BackgroundWeights = { stars: 1, lines: 1, particles: 1 };
	const parallax = { x: 0, y: 0, targetX: 0, targetY: 0 };

	const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

	const measure = () => ({
		width: Math.max(1, Math.round(container?.clientWidth || window.innerWidth || 1)),
		height: Math.max(1, Math.round(container?.clientHeight || window.innerHeight || 1)),
		dpr: Math.min(window.devicePixelRatio || 1, BG.render.maxDpr)
	});

	const paint = () => {
		if (!ctx || !scene || !sprites) return;
		renderScene(ctx, scene, sprites, aurora, {
			width,
			height,
			dpr,
			parallax,
			timeMs: elapsed,
			weights
		});
	};

	/** Resize: new bitmap size, keep the scene's positions, re-bake the viewport-sized wash. */
	const applySize = (nextWidth: number, nextHeight: number, nextDpr: number) => {
		if (!canvas) return;
		if (nextWidth === width && nextHeight === height && nextDpr === dpr) return;

		const dprChanged = nextDpr !== dpr;
		width = nextWidth;
		height = nextHeight;
		dpr = nextDpr;

		const pixelWidth = Math.round(width * dpr);
		const pixelHeight = Math.round(height * dpr);
		if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
		if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

		if (scene) resizeScene(scene, width, height);
		if (scene && dprChanged) sprites = createSceneSprites(scene, dpr);
		aurora = enableAurora ? createAuroraSprite(width, height) : null;

		if (!running) paint();
	};

	const scheduleResize = () => {
		if (resizeTimer !== 0) clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			resizeTimer = 0;
			const next = measure();
			applySize(next.width, next.height, next.dpr);
		}, BG.lifecycle.resizeDebounceMs);
	};

	const settled = () => weights.stars < 0.005 && weights.lines < 0.005 && weights.particles < 0.005;

	const easeWeights = (step: number) => {
		const target = TIERS[tier];
		const ease = 1 - Math.pow(1 - BG.quality.fadePerFrame, step);
		weights.stars += ((enableStars ? target.stars : 0) - weights.stars) * ease;
		weights.lines += ((enableStars ? target.lines : 0) - weights.lines) * ease;
		weights.particles += ((enableParticles ? target.particles : 0) - weights.particles) * ease;
	};

	/** Rolling frame-time estimate; one tier drop per sustained overrun, never up. */
	const govern = (rawDt: number) => {
		if (LAST_TIER === 0) return;
		framesSinceTier++;
		// A single stall (GC, tab restore, hydration) is not steady load.
		if (rawDt > BG.quality.ignoreFrameAboveMs) return;

		frameTimes[sampleIndex] = rawDt;
		sampleIndex = (sampleIndex + 1) % frameTimes.length;
		sampleCount = Math.min(sampleCount + 1, frameTimes.length);
		if (framesSinceTier < BG.quality.settleFrames || sampleCount < frameTimes.length) return;

		let total = 0;
		for (let i = 0; i < sampleCount; i++) total += frameTimes[i];
		if (total / sampleCount <= BG.quality.degradeAboveMs) return;
		if (tier >= LAST_TIER) return;

		tier++;
		framesSinceTier = 0;
		sampleIndex = 0;
		sampleCount = 0;
	};

	const stop = () => {
		running = false;
		lastFrame = 0;
		if (rafId !== 0) cancelAnimationFrame(rafId);
		rafId = 0;
	};

	const start = () => {
		if (destroyed || running || reduced) return;
		running = true;
		lastFrame = 0;
		framesSinceTier = 0;
		sampleIndex = 0;
		sampleCount = 0;
		rafId = requestAnimationFrame(frame);
	};

	const frame = (timestamp: number) => {
		rafId = 0;
		if (destroyed) return;

		const rawDt = lastFrame === 0 ? FRAME_MS : timestamp - lastFrame;
		lastFrame = timestamp;

		const dt = clamp(rawDt, 1, 50);
		const step = Math.min(dt / FRAME_MS, 3);
		elapsed += dt;

		const ease = 1 - Math.pow(1 - BG.parallax.ease, step);
		parallax.x += (parallax.targetX - parallax.x) * ease;
		parallax.y += (parallax.targetY - parallax.y) * ease;

		if (scene) {
			updateScene(scene, step, timestamp);
			updateConnections(scene, timestamp, step);
		}
		easeWeights(step);
		paint();
		govern(rawDt);

		// Fully degraded: the sky is now still, so there is nothing left to animate.
		if (tier === LAST_TIER && settled()) {
			stop();
			return;
		}
		rafId = requestAnimationFrame(frame);
	};

	const resetParallax = () => {
		parallax.targetX = 0;
		parallax.targetY = 0;
	};

	const onPointerMove = (event: PointerEvent) => {
		if (event.pointerType === 'touch') return;
		// The layer is `position: fixed; inset: 0`, so client coordinates are layer
		// coordinates and the size is the cached viewport size — no layout read here.
		const nx = clamp((event.clientX / width) * 2 - 1, -1, 1);
		const ny = clamp((event.clientY / height) * 2 - 1, -1, 1);
		parallax.targetX = nx * BG.parallax.maxOffsetPx;
		parallax.targetY = ny * BG.parallax.maxOffsetPx;

		if (scene && enableStars) {
			activateStars(scene, event.clientX, event.clientY, performance.now());
		}
	};

	const onPointerOut = (event: PointerEvent) => {
		if (!event.relatedTarget) resetParallax();
	};

	const onVisibilityChange = () => {
		if (document.hidden) {
			stop();
		} else if (!reduced && tier < LAST_TIER) {
			start();
		}
	};

	const onMotionChange = (event: MediaQueryListEvent) => {
		reduced = event.matches;
		if (reduced) {
			stop();
			paint();
		} else if (tier < LAST_TIER) {
			start();
		}
	};

	onMount(() => {
		if (!canvas || !container) return;
		ctx = canvas.getContext('2d', { alpha: true });
		if (!ctx) return;

		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduced = motionQuery.matches;

		// Props are mount-time configuration (they are static on every page today).
		weights.stars = enableStars ? 1 : 0;
		weights.lines = enableStars ? 1 : 0;
		weights.particles = enableParticles ? 1 : 0;

		const initial = measure();
		width = initial.width;
		height = initial.height;
		dpr = initial.dpr;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);

		scene = createScene({
			width,
			height,
			starCount,
			particleCount,
			cloudCount,
			enableStars,
			enableParticles,
			enableClouds
		});
		sprites = createSceneSprites(scene, dpr);
		aurora = enableAurora ? createAuroraSprite(width, height) : null;

		// Reduced motion still gets the sky, just a still one.
		paint();
		if (!reduced) startTimer = window.setTimeout(start, BG.initDelayMs);

		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('pointerout', onPointerOut, { passive: true });
		window.addEventListener('blur', resetParallax);
		window.addEventListener('resize', scheduleResize, { passive: true });
		document.addEventListener('visibilitychange', onVisibilityChange);
		motionQuery.addEventListener('change', onMotionChange);

		const observer = new ResizeObserver(scheduleResize);
		observer.observe(container);

		return () => {
			destroyed = true;
			stop();
			if (startTimer !== 0) clearTimeout(startTimer);
			if (resizeTimer !== 0) clearTimeout(resizeTimer);
			observer.disconnect();
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerout', onPointerOut);
			window.removeEventListener('blur', resetParallax);
			window.removeEventListener('resize', scheduleResize);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			motionQuery.removeEventListener('change', onMotionChange);
			scene = null;
			sprites = null;
			aurora = null;
			ctx = null;
		};
	});
</script>

<div bind:this={container} class="interactive-background" aria-hidden="true">
	<canvas bind:this={canvas} class="background-canvas"></canvas>
</div>

<style>
	/*
	 * Same box as the DOM implementation: fixed, full viewport, z-index 1, and
	 * transparent to pointer events. Overflow hides the parallax bleed at the edges.
	 */
	.interactive-background {
		position: fixed;
		inset: 0;
		overflow: hidden;
		z-index: 1;
		pointer-events: none;
	}

	.background-canvas {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
