/**
 * Types for `pixeltext.js`, a verbatim copy of the plugin's pixel font.
 *
 * The implementation stays JavaScript; this declaration only lets
 * `svelte-check` type the imports without turning the copied module into hand
 * ported TypeScript.
 */

export const GLYPH_W: number;
export const GLYPH_H: number;
export const TRACKING: number;
export const SPACE_ADVANCE: number;
export const GLYPHS: Readonly<Record<string, readonly string[]>>;
export const FALLBACK: readonly string[];

export function hasGlyph(character: string): boolean;
export function glyphSet(): string;
export function missingGlyphs(text: string): string[];
export function measureText(text: string, scale?: number): { width: number; height: number };
export function drawText(
	target: {
		fillStyle: string;
		fillRect(x: number, y: number, width: number, height: number): void;
	},
	text: string,
	options?: { x?: number; y?: number; scale?: number; colour?: string }
): number;
export function wrapText(text: string, maxWidth: number): string[];
