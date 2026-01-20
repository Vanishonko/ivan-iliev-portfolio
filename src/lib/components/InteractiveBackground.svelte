<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { INTERACTIVE_BACKGROUND as BG } from '$lib/constants';

	const DEPTH = BG.parallax.depth;

	type Star = {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		opacity: number;
		twinkleSpeed: number;
		floatPhase: number;
		floatSpeed: number;
		activated: boolean;
		activationTime: number;
	};

	type Particle = {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		baseOpacity: number;
		opacity: number;
		twinklePhase: number;
		twinkleSpeed: number;
		floatPhase: number;
		floatSpeed: number;
		floatAmplitude: number;
		blur: number;
		tint: string;
	};

	type Cloud = {
		x: number;
		y: number;
		size: number;
		speed: number;
		opacity: number;
	};

	type Connection = {
		id: string;
		from: number;
		to: number;
		distance: number;
		opacity: number;
		progress: number;
		fade: number;
	};

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
	let stars = $state<Star[]>([]);
	let particles = $state<Particle[]>([]);
	let clouds = $state<Cloud[]>([]);
	let connections = $state<Connection[]>([]);
	let rafId: number | null = null;
	let parallax = $state({ x: 0, y: 0 });
	let parallaxTarget = $state({ x: 0, y: 0 });

	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
	const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
	const approach = (current: number, target: number, ease: number) =>
		current + (target - current) * ease;
	const wrap = (v: number, max: number) => (v < 0 ? max : v > max ? 0 : v);
	const connId = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

	const getBounds = () => {
		const w = container?.offsetWidth || window.innerWidth;
		const h = container?.offsetHeight || window.innerHeight;
		return { w, h };
	};

	const initStars = (w: number, h: number) => {
		stars = Array.from({ length: starCount }, () => ({
			x: Math.random() * w,
			y: Math.random() * h,
			vx: (Math.random() - 0.5) * BG.stars.drift,
			vy: (Math.random() - 0.5) * BG.stars.drift,
			size: rand(BG.stars.minSize, BG.stars.maxSize),
			opacity: rand(BG.stars.startOpacityMin, BG.stars.startOpacityMax),
			twinkleSpeed: rand(BG.stars.twinkleSpeedMin, BG.stars.twinkleSpeedMax),
			floatPhase: Math.random() * Math.PI * 2,
			floatSpeed: rand(BG.stars.floatSpeedMin, BG.stars.floatSpeedMax),
			activated: false,
			activationTime: 0
		}));
	};

	const initParticles = (w: number, h: number) => {
		const palette = [
			...BG.particles.palette,
			BG.particles.palette[0],
			BG.particles.palette[1],
			BG.particles.palette[2]
		] as const;

		particles = Array.from({ length: particleCount }, () => {
			const angle = Math.random() * Math.PI * 2;
			const drift = rand(BG.particles.driftMin, BG.particles.driftMax);
			const baseOpacity = rand(BG.particles.opacityMin, BG.particles.opacityMax);

			return {
				x: Math.random() * w,
				y: Math.random() * h,
				vx: Math.cos(angle) * drift,
				vy: Math.sin(angle) * drift,
				size: rand(BG.particles.minSize, BG.particles.maxSize),
				baseOpacity,
				opacity: baseOpacity,
				twinklePhase: Math.random() * Math.PI * 2,
				twinkleSpeed: rand(BG.particles.twinkleSpeedMin, BG.particles.twinkleSpeedMax),
				floatPhase: Math.random() * Math.PI * 2,
				floatSpeed: rand(BG.particles.floatSpeedMin, BG.particles.floatSpeedMax),
				floatAmplitude: rand(BG.particles.floatAmpMin, BG.particles.floatAmpMax),
				blur: rand(BG.particles.blurMin, BG.particles.blurMax),
				tint: pick(palette)
			};
		});
	};

	const initClouds = (w: number, h: number) => {
		clouds = Array.from({ length: cloudCount }, () => ({
			x: Math.random() * w,
			y: Math.random() * (h * BG.clouds.yMaxRatio),
			size: rand(BG.clouds.minSize, BG.clouds.maxSize),
			speed: rand(BG.clouds.minSpeed, BG.clouds.maxSpeed),
			opacity: rand(BG.clouds.opacityMin, BG.clouds.opacityMax)
		}));
	};

	const initScene = () => {
		if (!container) return;
		const { w, h } = getBounds();

		if (enableStars) initStars(w, h);
		if (enableParticles) initParticles(w, h);
		if (enableClouds) initClouds(w, h);

		// reset lines so we dont keep references to old star indices
		connections = [];
	};

	const resetParallax = () => {
		parallaxTarget.x = 0;
		parallaxTarget.y = 0;
	};

	const handleMouseOut = (e: MouseEvent) => {
		if (!e.relatedTarget) resetParallax();
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!container) return;

		const rect = container.getBoundingClientRect();
		if (!rect || rect.width === 0 || rect.height === 0) return;
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const nx = clamp((mx - rect.width / 2) / (rect.width / 2), -1, 1);
		const ny = clamp((my - rect.height / 2) / (rect.height / 2), -1, 1);
		parallaxTarget.x = nx * BG.parallax.maxOffsetPx;
		parallaxTarget.y = ny * BG.parallax.maxOffsetPx;

		if (!enableStars || stars.length === 0) return;
		const now = performance.now();
		const r2 = BG.stars.activationRadius * BG.stars.activationRadius;

		for (const star of stars) {
			const dx = mx - star.x;
			const dy = my - star.y;
			if (dx * dx + dy * dy <= r2) {
				star.activated = true;
				star.activationTime = now;
			}
		}
	};

	const updateParallax = () => {
		parallax.x = approach(parallax.x, parallaxTarget.x, BG.parallax.ease);
		parallax.y = approach(parallax.y, parallaxTarget.y, BG.parallax.ease);
	};

	const updateStars = (w: number, h: number, now: number) => {
		for (const star of stars) {
			// activation decay
			if (star.activated && now - star.activationTime > BG.stars.activationMs) {
				star.activated = false;
			}

			star.floatPhase += star.floatSpeed;
			const fx = Math.sin(star.floatPhase) * BG.stars.floatAmplitude;
			const fy = Math.cos(star.floatPhase * 0.7) * BG.stars.floatAmplitude;

			star.x = wrap(star.x + star.vx + fx, w);
			star.y = wrap(star.y + star.vy + fy, h);

			star.opacity += star.twinkleSpeed;
			if (star.opacity > BG.stars.twinkleMaxOpacity || star.opacity < BG.stars.twinkleMinOpacity) {
				star.twinkleSpeed *= -1;
			}
		}
	};

	const updateParticles = (w: number, h: number) => {
		for (const particle of particles) {
			particle.floatPhase += particle.floatSpeed;
			const fx = Math.sin(particle.floatPhase) * particle.floatAmplitude;
			const fy = Math.cos(particle.floatPhase * 0.7) * particle.floatAmplitude;
			particle.x = wrap(particle.x + particle.vx + fx, w);
			particle.y = wrap(particle.y + particle.vy + fy, h);
			particle.twinklePhase += particle.twinkleSpeed;
			particle.opacity = clamp(
				particle.baseOpacity + Math.sin(particle.twinklePhase) * BG.particles.twinkleAmplitude,
				BG.particles.opacityMin,
				BG.particles.opacityMax
			);
		}
	};

	const updateClouds = (w: number, h: number) => {
		for (const cloud of clouds) {
			cloud.x += cloud.speed;
			if (cloud.x > w + cloud.size) cloud.x = -cloud.size;
			cloud.y += Math.sin(cloud.x * 0.01) * 0.1;
			// keep em in-bounds on big displays
			if (cloud.y < 0) cloud.y = 0;
			if (cloud.y > h * BG.clouds.yMaxRatio) cloud.y = h * BG.clouds.yMaxRatio;
		}
	};

	const updateConnections = (now: number) => {
		const prev = new Map<string, Connection>();
		for (const c of connections) prev.set(c.id, c);

		const active: number[] = [];
		for (let i = 0; i < stars.length; i++) {
			if (stars[i].activated) active.push(i);
		}

		const next: Connection[] = [];

		for (let a = 0; a < active.length; a++) {
			for (let b = a + 1; b < active.length; b++) {
				const i = active[a];
				const j = active[b];
				const s1 = stars[i];
				const s2 = stars[j];

				const dx = s2.x - s1.x;
				const dy = s2.y - s1.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (distance >= BG.connections.maxDistance) continue;

				const id = connId(i, j);
				const existing = prev.get(id);

				const freshness1 = Math.max(0, 1 - (now - s1.activationTime) / BG.stars.activationMs);
				const freshness2 = Math.max(0, 1 - (now - s2.activationTime) / BG.stars.activationMs);
				const freshness = (freshness1 + freshness2) / 2;

				const baseOpacity = Math.max(
					0,
					BG.connections.baseOpacity - distance / BG.connections.maxDistance
				);
				const opacity = Math.min(
					BG.connections.maxOpacity,
					baseOpacity + freshness * BG.connections.freshnessBoost
				);

				next.push({
					id,
					from: i,
					to: j,
					distance,
					opacity,
					progress: approach(existing?.progress ?? 0, 1, BG.connections.drawEase),
					fade: Math.max(BG.connections.minFade, freshness)
				});

				prev.delete(id);
			}
		}

		// fade-out connections that expire
		for (const c of prev.values()) {
			const progress = approach(c.progress, 0, BG.connections.fadeOutEase);
			const fade = c.fade * BG.connections.fadeMultiplier;

			if (progress > BG.connections.keepThreshold || fade > BG.connections.keepThreshold) {
				next.push({ ...c, progress, fade });
			}
		}

		connections = next;
	};

	const tick = () => {
		if (!container) return;

		updateParallax();
		const now = performance.now();
		const { w, h } = getBounds();

		if (enableStars) {
			updateStars(w, h, now);
			updateConnections(now);
		}

		if (enableParticles) updateParticles(w, h);
		if (enableClouds) updateClouds(w, h);

		rafId = requestAnimationFrame(tick);
	};

	onMount(() => {
		if (!browser) return;

		const t = window.setTimeout(() => {
			initScene();
			tick();
		}, BG.initDelayMs);

		const onResize = () => initScene();
		window.addEventListener('resize', onResize, { passive: true });

		return () => {
			clearTimeout(t);
			window.removeEventListener('resize', onResize);
			if (rafId !== null) cancelAnimationFrame(rafId);
		};
	});
</script>

<svelte:window onmousemove={handleMouseMove} onmouseout={handleMouseOut} onblur={resetParallax} />

<div
	bind:this={container}
	class="interactive-background"
	style={`--px:${parallax.x}px; --py:${parallax.y}px; --d-stars:${DEPTH.stars}; --d-particles:${DEPTH.particles}; --d-clouds:${DEPTH.clouds}; --d-aurora:${DEPTH.aurora};`}
	aria-hidden="true"
>
	{#if enableAurora}
		<div class="aurora-wrapper parallax-aurora">
			<div class="aurora-layer"></div>
		</div>
	{/if}

	{#if enableStars}
		<div class="stars-layer parallax-stars">
			<svg class="constellation-lines" aria-hidden="true">
				{#each connections as conn (conn.id)}
					{@const star1 = stars[conn.from]}
					{@const star2 = stars[conn.to]}
					{@const dashLength = conn.distance * conn.progress}
					{@const dashGap = conn.distance * 2}
					<line
						x1={star1.x}
						y1={star1.y}
						x2={star2.x}
						y2={star2.y}
						stroke="url(#constellation-gradient)"
						stroke-width="0.5"
						opacity={conn.opacity * conn.fade}
						stroke-dasharray="{dashLength} {dashGap}"
						stroke-dashoffset="0"
					/>
				{/each}
				<defs>
					<linearGradient id="constellation-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" style="stop-color:rgba(255, 255, 255, 0.9);stop-opacity:1" />
						<stop offset="50%" style="stop-color:rgba(255, 255, 255, 0.95);stop-opacity:1" />
						<stop offset="100%" style="stop-color:rgba(255, 255, 255, 0.9);stop-opacity:1" />
					</linearGradient>
				</defs>
			</svg>

			{#each stars as star, i (i)}
				<div
					class="star"
					style="left: {star.x}px; top: {star.y}px; width: {star.size}px; height: {star.size}px; opacity: {star.opacity};"
				></div>
			{/each}
		</div>
	{/if}

	{#if enableClouds}
		<div class="clouds-layer parallax-clouds">
			{#each clouds as cloud, i (i)}
				<div
					class="cloud"
					style="left: {cloud.x}px; top: {cloud.y}px; width: {cloud.size}px; height: {cloud.size *
						0.6}px; opacity: {cloud.opacity};"
				></div>
			{/each}
		</div>
	{/if}

	{#if enableParticles}
		<div class="particles-layer parallax-particles">
			{#each particles as particle, i (i)}
				<div
					class="particle"
					style="left: {particle.x}px; top: {particle.y}px; width: {particle.size}px; height: {particle.size}px; opacity: {particle.opacity}; --p-tint: {particle.tint}; --p-blur: {particle.blur}px;"
				></div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.interactive-background {
		position: fixed;
		inset: 0;
		overflow: hidden;
		z-index: 1;
		pointer-events: none;
		--px: 0px;
		--py: 0px;
		--d-stars: 1;
		--d-particles: 0.67;
		--d-clouds: 0.26;
		--d-aurora: 0.13;
	}

	.parallax-stars,
	.parallax-particles,
	.parallax-clouds,
	.parallax-aurora {
		will-change: transform;
		transform: translate3d(0, 0, 0);
	}

	.parallax-stars {
		transform: translate3d(calc(var(--px) * var(--d-stars)), calc(var(--py) * var(--d-stars)), 0);
	}

	.parallax-particles {
		transform: translate3d(
			calc(var(--px) * var(--d-particles)),
			calc(var(--py) * var(--d-particles)),
			0
		);
	}

	.parallax-clouds {
		transform: translate3d(calc(var(--px) * var(--d-clouds)), calc(var(--py) * var(--d-clouds)), 0);
	}

	.parallax-aurora {
		transform: translate3d(calc(var(--px) * var(--d-aurora)), calc(var(--py) * var(--d-aurora)), 0);
	}

	.aurora-wrapper {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.aurora-layer {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				ellipse 80% 50% at 50% 30%,
				rgba(219, 39, 119, 0.15) 0%,
				rgba(168, 85, 247, 0.12) 30%,
				rgba(139, 92, 246, 0.08) 50%,
				transparent 70%
			),
			radial-gradient(
				ellipse 60% 40% at 70% 40%,
				rgba(236, 72, 153, 0.12) 0%,
				rgba(192, 132, 252, 0.1) 40%,
				transparent 70%
			);
		filter: blur(60px);
		animation: aurora-wave 20s ease-in-out infinite;
		opacity: 0.8;
		pointer-events: none;
	}

	@keyframes aurora-wave {
		0%,
		100% {
			transform: translateY(0) scaleY(1);
		}
		50% {
			transform: translateY(-30px) scaleY(1.1);
		}
	}

	.stars-layer {
		position: absolute;
		inset: 0;
	}

	.constellation-lines {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.constellation-lines line {
		transition:
			stroke-dasharray 0.1s ease,
			opacity 0.2s ease;
		filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.4))
			drop-shadow(0 0 4px rgba(219, 39, 119, 0.3)) drop-shadow(0 0 6px rgba(168, 85, 247, 0.2));
	}

	.star {
		position: absolute;
		background: radial-gradient(
			circle,
			rgba(255, 255, 255, 1) 0%,
			rgba(255, 255, 255, 0.7) 40%,
			transparent 80%
		);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		transition: opacity 0.3s ease;
		box-shadow:
			0 0 8px rgba(255, 255, 255, 0.9),
			0 0 16px rgba(219, 39, 119, 0.3),
			0 0 24px rgba(168, 85, 247, 0.2);
		pointer-events: none;
	}

	.clouds-layer {
		position: absolute;
		inset: 0;
	}

	.cloud {
		position: absolute;
		background: radial-gradient(
			ellipse at center,
			rgba(255, 255, 255, 0.6) 0%,
			rgba(255, 255, 255, 0.4) 40%,
			rgba(186, 230, 253, 0.2) 70%,
			transparent 100%
		);
		border-radius: 50%;
		filter: blur(50px);
		transform: translate(-50%, -50%);
		animation: cloud-float 20s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes cloud-float {
		0%,
		100% {
			transform: translate(-50%, -50%) translateY(0);
		}
		50% {
			transform: translate(-50%, -50%) translateY(-20px);
		}
	}

	.particles-layer {
		position: absolute;
		inset: 0;
	}

	.particle {
		position: absolute;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
		will-change: opacity, transform;
		filter: blur(var(--p-blur, 2.5px));
		background: radial-gradient(
			circle,
			rgba(255, 255, 255, 0.55) 0%,
			rgba(255, 255, 255, 0.25) 18%,
			var(--p-tint, rgba(168, 85, 247, 0.25)) 38%,
			transparent 78%
		);
		box-shadow:
			0 0 18px var(--p-tint, rgba(168, 85, 247, 0.25)),
			0 0 32px var(--p-tint, rgba(168, 85, 247, 0.25));
	}
</style>
