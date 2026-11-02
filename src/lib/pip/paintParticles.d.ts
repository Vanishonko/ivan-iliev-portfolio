/**
 * Types for `paintParticles.js`, a verbatim copy of the plugin's painter.
 * It takes any object with `fillStyle` and `fillRect`, which is exactly what a
 * 2D canvas context is.
 */

import type { Particle, ParticleTarget } from './particles';

export function drawParticles(
	target: ParticleTarget,
	particles: Particle[],
	options?: {
		font?: Readonly<Record<string, readonly string[]>>;
		fallback?: readonly string[];
		scale?: number;
	}
): void;
