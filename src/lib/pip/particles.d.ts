/**
 * Types for `particles.js`, a verbatim copy of the plugin's pure particle
 * model. The implementation stays JavaScript; only the shape crosses the
 * boundary into the Svelte component.
 */

export type ParticleTarget = {
	fillStyle: string | CanvasGradient | CanvasPattern;
	fillRect(x: number, y: number, width: number, height: number): void;
};

export type Particle = {
	id: string;
	kind: string;
	x: number;
	y: number;
	born: number;
	life: number;
	vx: number;
	vy: number;
	size: number;
	age?: number;
	atX?: number;
	atY?: number;
	alpha?: number;
};

export type ParticleRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type ParticleOrigin = {
	x: number;
	y: number;
	spreadX: number;
	spreadY: number;
};

export type Emitter = {
	kind: string;
	burst: readonly [number, number];
	every: number;
	life: readonly [number, number];
	kinds: readonly string[];
	rise: number;
	drift: number;
};

export const THOUGHT_EMITTERS: ReadonlySet<string>;
export const EMITTERS: Readonly<Record<string, Emitter>>;
export const KIND_STYLE: Readonly<
	Record<
		string,
		{
			text?: string;
			heart?: boolean;
			spark?: boolean;
			square?: boolean;
			ring?: boolean;
			colour: string;
			size: number;
			gravity: number;
		}
	>
>;
export const HEART_RUNS: readonly (readonly [number, number, number])[];
export const RING_RUNS: readonly (readonly [number, number, number])[];
export const PARTICLE_GLYPH: { width: number; height: number };

export function originForParticle(
	kind: string,
	rect: ParticleRect | null | undefined,
	fallback?: { x: number; y: number }
): ParticleOrigin;

export function spawn(
	existing: Particle[],
	options: {
		kind: string;
		x: number;
		y: number;
		now: number;
		random?: () => number;
		spreadX?: number;
		spreadY?: number;
	}
): Particle[];

export function update(
	particles: Particle[],
	now: number
): { particles: Particle[]; alive: boolean };

export function due(kind: string, lastAt: number, now: number): boolean;
