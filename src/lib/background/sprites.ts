import { INTERACTIVE_BACKGROUND as BG } from '$lib/constants';
import type { Cloud, Particle, Scene } from './scene';

/**
 * Sprite factory: every soft, expensive-to-rasterise thing in this background is
 * drawn once into a detached canvas and then blitted with `drawImage`.
 *
 * The gradient stops, shadow radii and blur radii below are the CSS the DOM version
 * used, copied verbatim; keeping them next to the drawing code makes the mapping
 * obvious. Counts, sizes, colours and timings still come from `constants.ts`.
 */

export type Sprite = {
	source: CanvasImageSource;
	/** Natural draw size in CSS pixels (the backing store is dpr times larger). */
	width: number;
	height: number;
};

export type SceneSprites = {
	/** One sprite per star size bucket. */
	stars: Sprite[];
	/** One per particle: its own tint, size and blur are baked in. */
	particles: Sprite[];
	/** One per cloud. */
	clouds: Sprite[];
};

type Surface = {
	canvas: HTMLCanvasElement | OffscreenCanvas;
	ctx: CanvasRenderingContext2D;
};

type GradientStop = readonly [offset: number, color: string];

/** Where the temporary shape is drawn so that only its shadow lands on the sprite. */
const OFFSCREEN = 100_000;

const STAR_LOOK = {
	// box-shadow: 0 0 8px rgba(255, 255, 255, 0.8)
	glowBlurPx: 8,
	glowColor: 'rgba(255, 255, 255, 0.8)',
	// 1.6x the blur radius is where a Gaussian shadow is effectively zero.
	glowPadPx: 13,
	// radial-gradient(circle, #fff 0%, rgba(255,255,255,.7) 40%, transparent 80%)
	coreStops: [
		[0, 'rgba(255, 255, 255, 1)'],
		[0.4, 'rgba(255, 255, 255, 0.7)'],
		[0.8, 'rgba(255, 255, 255, 0)']
	] as readonly GradientStop[]
};

const PARTICLE_LOOK = {
	// box-shadow: 0 0 18px var(--p-tint)
	glowBlurPx: 18,
	glowPadPx: 31
};

const CLOUD_LOOK = {
	blurPx: 50,
	blurPadPx: 75,
	// radial-gradient(ellipse at center, rgba(255,255,255,.6) 0%, rgba(255,255,255,.4) 40%,
	//   rgba(186,230,253,.2) 70%, transparent 100%)
	stops: [
		[0, 'rgba(255, 255, 255, 0.6)'],
		[0.4, 'rgba(255, 255, 255, 0.4)'],
		[0.7, 'rgba(186, 230, 253, 0.2)'],
		[1, 'rgba(186, 230, 253, 0)']
	] as readonly GradientStop[]
};

const AURORA_LOOK = {
	blurPx: 60,
	// Two `radial-gradient(ellipse …)` washes; radii are fractions of the viewport.
	ellipses: [
		{
			cx: 0.5,
			cy: 0.3,
			rx: 0.8,
			ry: 0.5,
			stops: [
				[0, 'rgba(219, 39, 119, 0.15)'],
				[0.3, 'rgba(168, 85, 247, 0.12)'],
				[0.5, 'rgba(139, 92, 246, 0.08)'],
				[0.7, 'rgba(139, 92, 246, 0)']
			] as readonly GradientStop[]
		},
		{
			cx: 0.7,
			cy: 0.4,
			rx: 0.6,
			ry: 0.4,
			stops: [
				[0, 'rgba(236, 72, 153, 0.12)'],
				[0.4, 'rgba(192, 132, 252, 0.1)'],
				[0.7, 'rgba(192, 132, 252, 0)']
			] as readonly GradientStop[]
		}
	] as const
};

function createSurface(width: number, height: number): Surface {
	const w = Math.max(1, Math.ceil(width));
	const h = Math.max(1, Math.ceil(height));
	let canvas: HTMLCanvasElement | OffscreenCanvas;
	if (typeof OffscreenCanvas === 'undefined') {
		const element = document.createElement('canvas');
		element.width = w;
		element.height = h;
		canvas = element;
	} else {
		canvas = new OffscreenCanvas(w, h);
	}
	const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D | null;
	if (!ctx) throw new Error('2D canvas is unavailable');
	return { canvas, ctx };
}

/**
 * Blur the whole surface once, in place, through a scratch copy.
 *
 * `ctx.filter` is the fast path and the only one most browsers need. Safari (and every
 * iOS browser, which is WebKit) does not expose it, and a silent `return` there was
 * shipping raw, unblurred gradients to iPhones — visible as hard ellipses. So when the
 * filter is missing, fall back to a real blur instead of doing nothing.
 */
function blurSurface(surface: Surface, blurPx: number) {
	const { canvas, ctx } = surface;
	if (blurPx <= 0) return;

	if (typeof ctx.filter === 'string') {
		const copy = createSurface(canvas.width, canvas.height);
		copy.ctx.drawImage(canvas, 0, 0);
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.filter = `blur(${blurPx}px)`;
		ctx.drawImage(copy.canvas, 0, 0);
		ctx.filter = 'none';
		return;
	}

	if (blurPx >= 16) pyramidBlur(surface, blurPx);
	else fallbackBlur(surface, blurPx);
}

/**
 * Cheap wide blur for big soft sprites: halve, halve, halve — then scale back up.
 *
 * Every step is a `drawImage` with smoothing, so the cost is a couple of full-screen blits
 * rather than a pixel loop, and the result is a smooth wide wash. Used for the aurora and
 * the clouds, where the target radius is tens of pixels; below that the box blur is both
 * cheaper and closer to a real Gaussian.
 */
function pyramidBlur(surface: Surface, blurPx: number) {
	const { canvas, ctx } = surface;
	let levels = 1;
	while (levels < 6 && blurPx / Math.pow(2, levels) > 0.75) levels++;

	const chain: Surface[] = [createSurface(canvas.width, canvas.height)];
	chain[0].ctx.drawImage(canvas, 0, 0);

	let current = chain[0];
	for (let level = 0; level < levels; level++) {
		const width = Math.max(1, Math.floor(current.canvas.width / 2));
		const height = Math.max(1, Math.floor(current.canvas.height / 2));
		const next = createSurface(width, height);
		next.ctx.imageSmoothingEnabled = true;
		next.ctx.imageSmoothingQuality = 'high';
		next.ctx.drawImage(current.canvas, 0, 0, width, height);
		chain.push(next);
		current = next;
	}

	for (let level = chain.length - 2; level >= 0; level--) {
		const target = chain[level];
		const targetCtx = target.ctx;
		targetCtx.clearRect(0, 0, target.canvas.width, target.canvas.height);
		targetCtx.imageSmoothingEnabled = true;
		targetCtx.imageSmoothingQuality = 'high';
		targetCtx.drawImage(
			current.canvas,
			0,
			0,
			current.canvas.width,
			current.canvas.height,
			0,
			0,
			target.canvas.width,
			target.canvas.height
		);
		current = target;
	}

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(current.canvas, 0, 0, canvas.width, canvas.height);
}

/**
 * A separable box blur, three passes, on a downscaled copy of the surface.
 *
 * Three moves: halve (or quarter) the resolution so the pixel loop stays small, blur the
 * four channels with a sliding-window sum (premultiplied, so transparent edges do not
 * bleed colour), then scale the result back up with smoothing. The result is softer and
 * slightly broader than a true Gaussian, which for a background wash is indistinguishable
 * — and it means an iPhone gets the same soft aurora as a desktop instead of nothing.
 */
function fallbackBlur(surface: Surface, blurPx: number) {
	const { canvas, ctx } = surface;
	const shortEdge = Math.min(canvas.width, canvas.height);
	// Downscale when the sprite is big enough that a full-resolution loop would be felt on
	// a phone; small sprites (particles, clouds) are already cheap.
	const step = shortEdge >= 512 ? 4 : shortEdge >= 192 ? 3 : 1;
	const w = Math.max(1, Math.round(canvas.width / step));
	const h = Math.max(1, Math.round(canvas.height / step));

	const scaled = createSurface(w, h);
	scaled.ctx.imageSmoothingQuality = 'high';
	scaled.ctx.drawImage(canvas, 0, 0, w, h);

	const image = scaled.ctx.getImageData(0, 0, w, h);
	boxBlurImageData(image, Math.max(1, Math.round(blurPx / step)));

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingQuality = 'high';
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(scaled.canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
}

/** Three-pass separable box blur over premultiplied RGBA, in place. */
function boxBlurImageData(image: ImageData, radius: number) {
	const { width: w, height: h, data } = image;
	if (radius < 1 || w < 2 || h < 2) return;

	const size = w * h * 4;
	const buffer = new Float32Array(size);
	for (let i = 0; i < size; i += 4) {
		const alpha = data[i + 3] / 255;
		buffer[i] = data[i] * alpha;
		buffer[i + 1] = data[i + 1] * alpha;
		buffer[i + 2] = data[i + 2] * alpha;
		buffer[i + 3] = data[i + 3];
	}

	const scratch = new Float32Array(size);
	const window = radius * 2 + 1;

	for (let pass = 0; pass < 3; pass++) {
		blurPass(buffer, scratch, w, h, window, true);
		blurPass(scratch, buffer, w, h, window, false);
	}

	for (let i = 0; i < size; i += 4) {
		const alpha = buffer[i + 3];
		if (alpha <= 0.0001) {
			data[i] = 0;
			data[i + 1] = 0;
			data[i + 2] = 0;
			data[i + 3] = 0;
			continue;
		}
		const inv = 255 / alpha;
		data[i] = Math.min(255, buffer[i] * inv);
		data[i + 1] = Math.min(255, buffer[i + 1] * inv);
		data[i + 2] = Math.min(255, buffer[i + 2] * inv);
		data[i + 3] = Math.min(255, alpha);
	}

	image.data.set(data);
}

/** One box-blur pass along x (horizontal) or y, edge-clamped. */
function blurPass(
	source: Float32Array,
	target: Float32Array,
	w: number,
	h: number,
	window: number,
	horizontal: boolean
) {
	const radius = (window - 1) / 2;
	const norm = 1 / window;
	const lines = horizontal ? h : w;
	const length = horizontal ? w : h;
	const stride = horizontal ? 4 : w * 4;

	for (let line = 0; line < lines; line++) {
		const base = horizontal ? line * w * 4 : line * 4;
		let r = 0;
		let g = 0;
		let b = 0;
		let a = 0;

		const at = (index: number) => {
			const clamped = index < 0 ? 0 : index >= length ? length - 1 : index;
			return base + clamped * stride;
		};

		for (let k = -radius; k <= radius; k++) {
			const i = at(k);
			r += source[i];
			g += source[i + 1];
			b += source[i + 2];
			a += source[i + 3];
		}

		for (let p = 0; p < length; p++) {
			const out = base + p * stride;
			target[out] = r * norm;
			target[out + 1] = g * norm;
			target[out + 2] = b * norm;
			target[out + 3] = a * norm;

			const incoming = at(p + radius + 1);
			const outgoing = at(p - radius);
			r += source[incoming] - source[outgoing];
			g += source[incoming + 1] - source[outgoing + 1];
			b += source[incoming + 2] - source[outgoing + 2];
			a += source[incoming + 3] - source[outgoing + 3];
		}
	}
}

/**
 * Break up 8-bit banding with a 4x4 ordered dither.
 *
 * A full-viewport gradient at 8-12% alpha spans only a handful of 8-bit steps, so it
 * quantises into visible contours no matter how large the blur is. Offsetting each pixel
 * by a fraction of a level in a Bayer pattern moves the contour boundaries below the eye's
 * threshold and costs one pass at sprite-build time. The alpha channel gets half the
 * amplitude; dithering it as hard as colour reads as speckle in a translucent wash.
 */
const BAYER_4 = [
	0, 8, 2, 10,
	12, 4, 14, 6,
	3, 11, 1, 9,
	15, 7, 13, 5
] as const;

function ditherSurface(surface: Surface, amplitude: number) {
	const { canvas, ctx } = surface;
	if (!(amplitude > 0) || canvas.width < 2 || canvas.height < 2) return;

	const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = image.data;

	for (let y = 0; y < canvas.height; y++) {
		const rowBase = (y & 3) * 4;
		for (let x = 0; x < canvas.width; x++) {
			const i = (y * canvas.width + x) * 4;
			const alpha = data[i + 3];
			if (alpha === 0) continue;

			// -0.5 .. +0.5 in units of `amplitude`
			const t = BAYER_4[rowBase + (x & 3)] / 16 - 0.5;
			const offset = t * 2 * amplitude;
			const alphaOffset = offset * 0.5;

			data[i] = clampByte(data[i] + offset);
			data[i + 1] = clampByte(data[i + 1] + offset);
			data[i + 2] = clampByte(data[i + 2] + offset);
			data[i + 3] = clampByte(alpha + alphaOffset);
		}
	}

	ctx.putImageData(image, 0, 0);
}

function clampByte(value: number) {
	return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Fill an elliptical radial gradient. Canvas only has circular gradients, so the
 * context is scaled into the ellipse's coordinate space first.
 */
function fillEllipseGradient(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	stops: readonly GradientStop[]
) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.scale(Math.max(rx, 0.001), Math.max(ry, 0.001));
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
	for (const [offset, color] of stops) gradient.addColorStop(offset, color);
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(0, 0, 1, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

/**
 * Draw only the shadow of a disc: the shape itself is painted far outside the
 * surface and its shadow is offset back onto it. That is the canvas equivalent of
 * `box-shadow: 0 0 <blur> <color>`, which the DOM version used for every glow.
 */
function drawShadowDisc(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	radius: number,
	blurPx: number,
	color: string
) {
	ctx.save();
	ctx.shadowColor = color;
	ctx.shadowBlur = blurPx;
	ctx.shadowOffsetX = -OFFSCREEN;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(cx + OFFSCREEN, cy, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function createStarSprite(size: number, scale: number): Sprite {
	const pad = STAR_LOOK.glowPadPx;
	const cssSize = size + pad * 2;
	const surface = createSurface(cssSize * scale, cssSize * scale);
	const center = (cssSize / 2) * scale;
	const radius = (size / 2) * scale;

	drawShadowDisc(
		surface.ctx,
		center,
		center,
		radius,
		STAR_LOOK.glowBlurPx * scale,
		STAR_LOOK.glowColor
	);

	// The core is the old radial-gradient clipped to the star's round box. Its ending
	// shape is `farthest-corner`, i.e. radius * sqrt(2).
	const ctx = surface.ctx;
	ctx.save();
	ctx.beginPath();
	ctx.arc(center, center, radius, 0, Math.PI * 2);
	ctx.clip();
	fillEllipseGradient(
		ctx,
		center,
		center,
		radius * Math.SQRT2,
		radius * Math.SQRT2,
		STAR_LOOK.coreStops
	);
	ctx.restore();

	return { source: surface.canvas, width: cssSize, height: cssSize };
}

function createParticleSprite(particle: Particle, scale: number): Sprite {
	const pad = PARTICLE_LOOK.glowPadPx;
	const cssSize = particle.size + pad * 2;
	const surface = createSurface(cssSize * scale, cssSize * scale);
	const center = (cssSize / 2) * scale;
	const radius = (particle.size / 2) * scale;
	const ctx = surface.ctx;

	drawShadowDisc(ctx, center, center, radius, PARTICLE_LOOK.glowBlurPx * scale, particle.tint);

	ctx.save();
	ctx.beginPath();
	ctx.arc(center, center, radius, 0, Math.PI * 2);
	ctx.clip();
	fillEllipseGradient(ctx, center, center, radius * Math.SQRT2, radius * Math.SQRT2, [
		[0, 'rgba(255, 255, 255, 0.55)'],
		[0.18, 'rgba(255, 255, 255, 0.25)'],
		[0.38, particle.tint],
		[0.78, 'rgba(255, 255, 255, 0)']
	]);
	ctx.restore();

	// The old element carried `filter: blur(<1.6–4.4>px)`; bake it into the bitmap.
	blurSurface(surface, particle.blur * scale);

	return { source: surface.canvas, width: cssSize, height: cssSize };
}

function createCloudSprite(cloud: Cloud, scale: number): Sprite {
	const width = cloud.size;
	const height = cloud.size * 0.6;
	const pad = CLOUD_LOOK.blurPadPx;
	const cssWidth = width + pad * 2;
	const cssHeight = height + pad * 2;
	const surface = createSurface(cssWidth * scale, cssHeight * scale);
	const ctx = surface.ctx;
	const cx = (cssWidth / 2) * scale;
	const cy = (cssHeight / 2) * scale;

	// border-radius: 50% — the background is clipped to the ellipse.
	ctx.save();
	ctx.beginPath();
	ctx.ellipse(cx, cy, (width / 2) * scale, (height / 2) * scale, 0, 0, Math.PI * 2);
	ctx.clip();
	fillEllipseGradient(
		ctx,
		cx,
		cy,
		(width / 2) * Math.SQRT2 * scale,
		(height / 2) * Math.SQRT2 * scale,
		CLOUD_LOOK.stops
	);
	ctx.restore();

	blurSurface(surface, CLOUD_LOOK.blurPx * scale);

	return { source: surface.canvas, width: cssWidth, height: cssHeight };
}

/** The aurora wash: viewport-sized, blurred once, dithered once, drawn as a single image. */
export function createAuroraSprite(width: number, height: number): Sprite {
	const scale = BG.render.auroraResolutionScale;
	const surface = createSurface(width * scale, height * scale);
	const ctx = surface.ctx;

	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, width * scale, height * scale);
	ctx.clip();
	for (const ellipse of AURORA_LOOK.ellipses) {
		fillEllipseGradient(
			ctx,
			ellipse.cx * width * scale,
			ellipse.cy * height * scale,
			ellipse.rx * width * scale,
			ellipse.ry * height * scale,
			ellipse.stops
		);
	}
	ctx.restore();

	blurSurface(surface, AURORA_LOOK.blurPx * scale);
	ditherSurface(surface, BG.render.auroraDither);

	return { source: surface.canvas, width, height };
}

/** Sprite bucket for a star of this size; the size difference per bucket is < 0.4px. */
export function starSpriteIndex(size: number): number {
	const buckets = BG.render.starSpriteBuckets;
	if (buckets <= 1) return 0;
	const span = BG.stars.maxSize - BG.stars.minSize;
	const t = span > 0 ? (size - BG.stars.minSize) / span : 0;
	return Math.max(0, Math.min(buckets - 1, Math.round(t * (buckets - 1))));
}

export function createSceneSprites(scene: Scene, dpr: number): SceneSprites {
	const scale = Math.min(dpr, BG.render.maxDpr);
	const buckets = BG.render.starSpriteBuckets;
	const stars: Sprite[] = [];
	for (let i = 0; i < buckets; i++) {
		const t = buckets <= 1 ? 0 : i / (buckets - 1);
		const size = BG.stars.minSize + (BG.stars.maxSize - BG.stars.minSize) * t;
		stars.push(createStarSprite(size, scale));
	}

	return {
		stars,
		particles: scene.particles.map((particle) => createParticleSprite(particle, scale)),
		// Clouds are 50px-blurred mush: CSS-pixel resolution is plenty on any display.
		clouds: scene.clouds.map((cloud) =>
			createCloudSprite(cloud, Math.min(1, dpr) * BG.render.cloudResolutionScale)
		)
	};
}
