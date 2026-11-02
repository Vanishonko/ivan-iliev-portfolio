/**
 * Types for `antenna.js`, which is a verbatim copy of the plugin's plain-JS
 * module. The implementation stays JavaScript; this declaration is only here so
 * `svelte-check` can type the import.
 */

export type AntennaRest = {
	angle: number;
	length: number;
	stiffness: number;
	damping: number;
	lengthStiffness: number;
	lengthDamping: number;
};

export type AntennaPoint = { x: number; y: number };

export type AntennaState = {
	anchor: AntennaPoint;
	angle: number;
	length: number;
	angularVelocity: number;
	lengthVelocity: number;
	dragged: boolean;
	dragVelocity: { angle: number; length: number };
	rest: AntennaRest;
	dragAt: number;
};

export type AntennaContext = {
	clearRect(x: number, y: number, width: number, height: number): void;
	fillRect(x: number, y: number, width: number, height: number): void;
	fillStyle: string | CanvasGradient | CanvasPattern;
};

export type AntennaStepOptions = {
	dt?: number;
	anchor?: AntennaPoint;
	rest?: AntennaRest | string;
	bodyVelocity?: AntennaPoint;
};

export const ANTENNA_REST: Readonly<Record<string, AntennaRest>>;

export const ANTENNA_LIMITS: {
	readonly minX: number;
	readonly maxX: number;
	readonly minY: number;
	readonly maxY: number;
	readonly minLength: number;
	readonly maxLength: number;
	readonly maxAngle: number;
};

export const ANTENNA_STYLE: {
	readonly stem: string;
	readonly stemLight: string;
	readonly outline: string;
	readonly bulb: string;
	readonly highlight: string;
};

export const ANTENNA_BULB: readonly string[];

export function createAntenna(options?: {
	anchor?: AntennaPoint;
	rest?: AntennaRest | string;
}): AntennaState;

export function stepAntenna(
	state: AntennaState,
	options?: AntennaStepOptions
): AntennaState | undefined;

export function pullAntenna(
	state: AntennaState,
	point: AntennaPoint,
	options?: { now?: number }
): AntennaState | undefined;

export function releaseAntenna(
	state: AntennaState,
	options?: { now?: number }
): AntennaState | undefined;

export function antennaTip(state: AntennaState): AntennaPoint;

export function antennaSegments(state: AntennaState): [AntennaPoint, AntennaPoint, AntennaPoint];

export function drawAntenna(
	context: AntennaContext,
	state: AntennaState,
	options?: { cell?: number }
): void;
