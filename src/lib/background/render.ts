import { INTERACTIVE_BACKGROUND as BG } from '$lib/constants';
import type { Scene } from './scene';
import { starSpriteIndex, type SceneSprites, type Sprite } from './sprites';

/**
 * The paint half of the background: one 2D canvas, one clear, ~85 drawImage calls.
 *
 * Layer order matches the DOM version exactly (aurora, stars + constellation lines,
 * clouds, bokeh particles), and every layer is offset by the same pointer parallax
 * multiplied by its own depth.
 */

export type BackgroundWeights = {
	stars: number;
	lines: number;
	particles: number;
};

export type RenderView = {
	width: number;
	height: number;
	dpr: number;
	parallax: { x: number; y: number };
	/** Animation clock in ms; only advances while the loop is running. */
	timeMs: number;
	weights: BackgroundWeights;
};

const DEPTH = BG.parallax.depth;

export function renderScene(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	sprites: SceneSprites,
	aurora: Sprite | null,
	view: RenderView
) {
	ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
	ctx.globalAlpha = 1;
	ctx.clearRect(0, 0, view.width, view.height);

	if (aurora) drawAurora(ctx, aurora, view);
	drawStars(ctx, scene, sprites, view);
	drawClouds(ctx, scene, sprites, view);
	drawParticles(ctx, scene, sprites, view);
	ctx.globalAlpha = 1;
}

/**
 * The old `.aurora-layer`: two radial washes, a 60px blur (baked into the sprite)
 * and a 20s `translateY(-30px) scaleY(1.1)` wave, at 80% opacity.
 */
function drawAurora(ctx: CanvasRenderingContext2D, aurora: Sprite, view: RenderView) {
	const { width, height } = view;
	const wave = 0.5 - 0.5 * Math.cos((view.timeMs / BG.render.auroraWaveMs) * Math.PI * 2);
	const offsetY = -BG.render.auroraWaveOffsetPx * wave;
	const scaleY = 1 + (BG.render.auroraWaveScaleY - 1) * wave;

	ctx.save();
	ctx.globalAlpha = BG.render.auroraOpacity;
	ctx.translate(view.parallax.x * DEPTH.aurora, view.parallax.y * DEPTH.aurora + offsetY);
	ctx.translate(width / 2, height / 2);
	ctx.scale(1, scaleY);
	ctx.translate(-width / 2, -height / 2);
	ctx.drawImage(aurora.source, 0, 0, width, height);
	ctx.restore();
}

function drawStars(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	sprites: SceneSprites,
	view: RenderView
) {
	const weight = view.weights.stars;
	if (weight < 0.01) return;
	const offsetX = view.parallax.x * DEPTH.stars;
	const offsetY = view.parallax.y * DEPTH.stars;

	drawConnections(ctx, scene, view, offsetX, offsetY);

	for (const star of scene.stars) {
		const sprite = sprites.stars[starSpriteIndex(star.size)];
		ctx.globalAlpha = star.opacity * weight;
		ctx.drawImage(
			sprite.source,
			star.x + offsetX - sprite.width / 2,
			star.y + offsetY - sprite.height / 2,
			sprite.width,
			sprite.height
		);
	}
}

/**
 * Constellation edges, in two passes: a wide faint pass standing in for the old
 * `drop-shadow`, then the crisp 0.5px line.
 *
 * Lines are grouped into a handful of alpha bands so a whole band is one path and
 * one `stroke()`. `progress` grows the segment from its source star, which is what
 * the per-frame `stroke-dasharray` used to do.
 */
function drawConnections(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	view: RenderView,
	offsetX: number,
	offsetY: number
) {
	const weight = view.weights.lines;
	if (weight < 0.01 || scene.connections.size === 0) return;

	const bands = BG.render.lineAlphaBands;
	const maxAlpha = BG.connections.maxOpacity;

	for (let pass = 0; pass < 2; pass++) {
		const glow = pass === 0;
		const passAlpha = glow ? BG.render.lineGlowOpacity : 1;
		ctx.lineWidth = glow ? BG.render.lineGlowWidth : BG.render.lineWidth;
		ctx.strokeStyle = glow ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.95)';

		for (let band = 0; band < bands; band++) {
			const alpha = ((band + 0.5) / bands) * maxAlpha * passAlpha * weight;
			if (alpha < 0.01) continue;

			ctx.beginPath();
			let drawn = false;
			for (const connection of scene.connections.values()) {
				const value = connection.opacity * connection.fade;
				const index = Math.min(bands - 1, Math.floor((value / maxAlpha) * bands));
				if (index !== band) continue;

				const from = scene.stars[connection.from];
				const to = scene.stars[connection.to];
				ctx.moveTo(from.x + offsetX, from.y + offsetY);
				ctx.lineTo(
					from.x + (to.x - from.x) * connection.progress + offsetX,
					from.y + (to.y - from.y) * connection.progress + offsetY
				);
				drawn = true;
			}

			if (drawn) {
				ctx.globalAlpha = alpha;
				ctx.stroke();
			}
		}
	}
}

/** The old `.cloud`: one blurred ellipse sprite per cloud, drifting right and bobbing. */
function drawClouds(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	sprites: SceneSprites,
	view: RenderView
) {
	if (scene.clouds.length === 0) return;
	const offsetX = view.parallax.x * DEPTH.clouds;
	const offsetY = view.parallax.y * DEPTH.clouds;
	const bob =
		-BG.render.cloudBobPx *
		(0.5 - 0.5 * Math.cos((view.timeMs / BG.render.cloudBobMs) * Math.PI * 2));

	for (let i = 0; i < scene.clouds.length; i++) {
		const cloud = scene.clouds[i];
		const sprite = sprites.clouds[i];
		if (!sprite) continue;
		ctx.globalAlpha = cloud.opacity;
		ctx.drawImage(
			sprite.source,
			cloud.x + offsetX - sprite.width / 2,
			cloud.y + offsetY + bob - sprite.height / 2,
			sprite.width,
			sprite.height
		);
	}
}

function drawParticles(
	ctx: CanvasRenderingContext2D,
	scene: Scene,
	sprites: SceneSprites,
	view: RenderView
) {
	const weight = view.weights.particles;
	if (weight < 0.01) return;
	const offsetX = view.parallax.x * DEPTH.particles;
	const offsetY = view.parallax.y * DEPTH.particles;

	for (let i = 0; i < scene.particles.length; i++) {
		const particle = scene.particles[i];
		const sprite = sprites.particles[i];
		if (!sprite) continue;
		ctx.globalAlpha = particle.opacity * weight;
		ctx.drawImage(
			sprite.source,
			particle.x + offsetX - sprite.width / 2,
			particle.y + offsetY - sprite.height / 2,
			sprite.width,
			sprite.height
		);
	}
}
