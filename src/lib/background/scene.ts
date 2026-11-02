import { INTERACTIVE_BACKGROUND as BG } from '$lib/constants';

/**
 * The simulation half of the background: plain objects, no DOM, no Svelte. The
 * component owns the clock; everything here is a pure-ish mutation of the scene.
 *
 * Nothing in this file reads layout and nothing allocates per frame except the
 * constellation bookkeeping, which reuses existing objects.
 */

export type Star = {
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

export type Particle = {
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

export type Cloud = {
	x: number;
	y: number;
	size: number;
	speed: number;
	opacity: number;
};

export type Connection = {
	from: number;
	to: number;
	opacity: number;
	/** 0 → 1 draws the line in from the source star, as the old dash animation did. */
	progress: number;
	/** 1 → 0.2 fades an expired edge out; never below `minFade` while alive. */
	fade: number;
	/** Generation stamp: an edge that was not refreshed this tick is expiring. */
	stamp: number;
};

export type Scene = {
	width: number;
	height: number;
	stars: Star[];
	particles: Particle[];
	clouds: Cloud[];
	/** Live constellation edges, keyed by `from * 2^16 + to`. */
	connections: Map<number, Connection>;
	/** Reused list of activated star indices (no per-frame allocation). */
	active: number[];
	stamp: number;
};

export type SceneOptions = {
	width: number;
	height: number;
	starCount: number;
	particleCount: number;
	cloudCount: number;
	enableStars: boolean;
	enableParticles: boolean;
	enableClouds: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const approach = (current: number, target: number, ease: number) =>
	current + (target - current) * ease;

/** Hard wrap for the drifting simulation, same rule the DOM version used. */
const wrap = (value: number, max: number) => (value < 0 ? max : value > max ? 0 : value);

/** Wrap a coordinate into a new viewport without reshuffling the scene. */
const fold = (value: number, max: number) => ((value % max) + max) % max;

const pairKey = (from: number, to: number) => (from << 16) | to;

export function createScene(options: SceneOptions): Scene {
	const { width, height } = options;
	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

	const stars: Star[] = [];
	if (options.enableStars) {
		for (let i = 0; i < options.starCount; i++) {
			// Keep the order of the Math.random() calls stable: a seeded PRNG is how the
			// before/after screenshots are compared field by field.
			stars.push({
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * BG.stars.drift,
				vy: (Math.random() - 0.5) * BG.stars.drift,
				size: rand(BG.stars.minSize, BG.stars.maxSize),
				opacity: rand(BG.stars.startOpacityMin, BG.stars.startOpacityMax),
				twinkleSpeed: rand(BG.stars.twinkleSpeedMin, BG.stars.twinkleSpeedMax),
				floatPhase: Math.random() * Math.PI * 2,
				floatSpeed: rand(BG.stars.floatSpeedMin, BG.stars.floatSpeedMax),
				activated: false,
				activationTime: 0
			});
		}
	}

	const particles: Particle[] = [];
	if (options.enableParticles) {
		// The first three tints are repeated so the palette leans pink/purple, as before.
		const palette = [
			...BG.particles.palette,
			BG.particles.palette[0],
			BG.particles.palette[1],
			BG.particles.palette[2]
		] as const;

		for (let i = 0; i < options.particleCount; i++) {
			const angle = Math.random() * Math.PI * 2;
			const drift = rand(BG.particles.driftMin, BG.particles.driftMax);
			const baseOpacity = rand(BG.particles.opacityMin, BG.particles.opacityMax);

			particles.push({
				x: Math.random() * width,
				y: Math.random() * height,
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
			});
		}
	}

	const clouds: Cloud[] = [];
	if (options.enableClouds) {
		for (let i = 0; i < options.cloudCount; i++) {
			clouds.push({
				x: Math.random() * width,
				y: Math.random() * (height * BG.clouds.yMaxRatio),
				size: rand(BG.clouds.minSize, BG.clouds.maxSize),
				speed: rand(BG.clouds.minSpeed, BG.clouds.maxSpeed),
				opacity: rand(BG.clouds.opacityMin, BG.clouds.opacityMax)
			});
		}
	}

	return { width, height, stars, particles, clouds, connections: new Map(), active: [], stamp: 0 };
}

export function resizeScene(scene: Scene, width: number, height: number) {
	scene.width = width;
	scene.height = height;
	const cloudMaxY = height * BG.clouds.yMaxRatio;

	for (const star of scene.stars) {
		star.x = fold(star.x, width);
		star.y = fold(star.y, height);
	}
	for (const particle of scene.particles) {
		particle.x = fold(particle.x, width);
		particle.y = fold(particle.y, height);
	}
	for (const cloud of scene.clouds) {
		cloud.x = fold(cloud.x, width);
		cloud.y = Math.min(cloud.y, cloudMaxY);
	}
}

/** Light up every star within the activation radius of the pointer. */
export function activateStars(scene: Scene, x: number, y: number, now: number) {
	const radius = BG.stars.activationRadius;
	const radiusSquared = radius * radius;

	for (const star of scene.stars) {
		const dx = x - star.x;
		const dy = y - star.y;
		if (dx * dx + dy * dy <= radiusSquared) {
			star.activated = true;
			star.activationTime = now;
		}
	}
}

/**
 * Advance the drifting scene.
 *
 * `step` is elapsed time in 60 Hz frames (1 = one frame at 60 fps), so the tuning
 * constants keep their meaning on a 120 Hz display instead of running twice as fast.
 */
export function updateScene(scene: Scene, step: number, now: number) {
	const { width, height } = scene;

	for (const star of scene.stars) {
		if (star.activated && now - star.activationTime > BG.stars.activationMs) {
			star.activated = false;
		}

		star.floatPhase += star.floatSpeed * step;
		const driftX = Math.sin(star.floatPhase) * BG.stars.floatAmplitude;
		const driftY = Math.cos(star.floatPhase * 0.7) * BG.stars.floatAmplitude;

		star.x = wrap(star.x + (star.vx + driftX) * step, width);
		star.y = wrap(star.y + (star.vy + driftY) * step, height);

		star.opacity += star.twinkleSpeed * step;
		if (star.opacity > BG.stars.twinkleMaxOpacity || star.opacity < BG.stars.twinkleMinOpacity) {
			star.twinkleSpeed *= -1;
		}
	}

	for (const particle of scene.particles) {
		particle.floatPhase += particle.floatSpeed * step;
		const driftX = Math.sin(particle.floatPhase) * particle.floatAmplitude;
		const driftY = Math.cos(particle.floatPhase * 0.7) * particle.floatAmplitude;

		particle.x = wrap(particle.x + (particle.vx + driftX) * step, width);
		particle.y = wrap(particle.y + (particle.vy + driftY) * step, height);

		particle.twinklePhase += particle.twinkleSpeed * step;
		particle.opacity = clamp(
			particle.baseOpacity + Math.sin(particle.twinklePhase) * BG.particles.twinkleAmplitude,
			BG.particles.opacityMin,
			BG.particles.opacityMax
		);
	}

	for (const cloud of scene.clouds) {
		cloud.x += cloud.speed * step;
		if (cloud.x > width + cloud.size) cloud.x = -cloud.size;
		cloud.y += Math.sin(cloud.x * 0.01) * 0.1 * step;
		if (cloud.y < 0) cloud.y = 0;
		if (cloud.y > height * BG.clouds.yMaxRatio) cloud.y = height * BG.clouds.yMaxRatio;
	}
}

/**
 * Rebuild the constellation graph between activated stars.
 *
 * The DOM version reassigned an array of fresh objects every third frame and let
 * Svelte diff it. Here the edges live in a persistent map that is stamped on every
 * visit; anything not visited this tick is expiring and gets eased out in place.
 *
 * The eases are expressed per 50 ms update (the old cadence) and rescaled for the
 * actual frame time, so the draw-in still takes about a third of a second.
 */
export function updateConnections(scene: Scene, now: number, step: number) {
	const cadence = step / 3; // 3 frames at 60 fps = 50 ms
	const drawEase = 1 - Math.pow(1 - BG.connections.drawEase, cadence);
	const fadeOutEase = 1 - Math.pow(1 - BG.connections.fadeOutEase, cadence);
	const fadeMultiplier = Math.pow(BG.connections.fadeMultiplier, cadence);
	const maxDistance = BG.connections.maxDistance;

	const active = scene.active;
	active.length = 0;
	for (let i = 0; i < scene.stars.length; i++) {
		if (scene.stars[i].activated) active.push(i);
	}

	const stamp = ++scene.stamp;

	for (let a = 0; a < active.length; a++) {
		for (let b = a + 1; b < active.length; b++) {
			const from = active[a];
			const to = active[b];
			const first = scene.stars[from];
			const second = scene.stars[to];
			const dx = second.x - first.x;
			const dy = second.y - first.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance >= maxDistance) continue;

			const key = pairKey(from, to);
			let connection = scene.connections.get(key);
			if (!connection) {
				connection = { from, to, opacity: 0, progress: 0, fade: 0, stamp };
				scene.connections.set(key, connection);
			}

			const freshnessFrom = Math.max(0, 1 - (now - first.activationTime) / BG.stars.activationMs);
			const freshnessTo = Math.max(0, 1 - (now - second.activationTime) / BG.stars.activationMs);
			const freshness = (freshnessFrom + freshnessTo) / 2;
			const baseOpacity = Math.max(0, BG.connections.baseOpacity - distance / maxDistance);

			connection.opacity = Math.min(
				BG.connections.maxOpacity,
				baseOpacity + freshness * BG.connections.freshnessBoost
			);
			connection.progress = approach(connection.progress, 1, drawEase);
			connection.fade = Math.max(BG.connections.minFade, freshness);
			connection.stamp = stamp;
		}
	}

	for (const [key, connection] of scene.connections) {
		if (connection.stamp === stamp) continue;
		connection.progress = approach(connection.progress, 0, fadeOutEase);
		connection.fade *= fadeMultiplier;
		if (
			connection.progress <= BG.connections.keepThreshold &&
			connection.fade <= BG.connections.keepThreshold
		) {
			scene.connections.delete(key);
		}
	}
}
