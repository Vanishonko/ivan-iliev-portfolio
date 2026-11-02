/**
 * Per-frame antenna anchors, copied verbatim from `dsh-fren/client.js`'s
 * `ANTENNA_ANCHORS` (which `sync-client.mjs` generates from `sprites.js`).
 *
 * One `[x, y]` per frame of the sheet, in **unmirrored** cell pixels: x grows
 * right, y grows down. The anchor is the base of the stalk, which is the top of
 * Pip's crown for that frame. The plugin mirrors the whole flip layer for a
 * left-facing body, so these values are never mirrored here either — mirroring
 * both the drawing and the anchor would double-flip the stalk.
 */
export type AntennaAnchor = readonly [x: number, y: number];

export const ANTENNA_ANCHORS: Readonly<Record<string, readonly AntennaAnchor[]>> = {
	idle: [
		[16, 5],
		[16, 6],
		[16, 5],
		[17, 5],
		[16, 5],
		[15, 5],
		[16, 6],
		[15, 5]
	],
	walk: [
		[17, 5],
		[17, 6],
		[17, 5],
		[15, 5],
		[15, 6],
		[15, 5]
	],
	sit: [
		[16, 9],
		[16, 10],
		[16, 9]
	],
	sleep: [
		[16, 10],
		[16, 11],
		[16, 10],
		[16, 11]
	],
	look: [
		[17, 5],
		[17, 6],
		[15, 5],
		[16, 5]
	],
	happy: [
		[16, 7],
		[16, 3],
		[16, 3],
		[16, 6]
	],
	sad: [
		[16, 6],
		[16, 7],
		[16, 6],
		[16, 6]
	],
	work: [
		[17, 5],
		[17, 6],
		[17, 5],
		[15, 5]
	],
	jump: [
		[16, 8],
		[16, 3],
		[16, 3],
		[16, 3],
		[16, 7]
	],
	toke: [
		[16, 5],
		[16, 5],
		[16, 5],
		[16, 5],
		[16, 5],
		[16, 5],
		[16, 5],
		[16, 5]
	],
	giggle: [
		[16, 6],
		[16, 5],
		[17, 6],
		[16, 5]
	],
	laugh: [
		[17, 5],
		[17, 6],
		[16, 5],
		[15, 6]
	],
	laugh_hard: [
		[15, 4],
		[16, 7],
		[17, 4],
		[16, 7]
	],
	tipped: [
		[9, 20],
		[9, 21],
		[9, 20],
		[9, 21]
	],
	busted: [
		[16, 5],
		[15, 6],
		[19, 5],
		[19, 5]
	],
	bolt: [
		[19, 5],
		[19, 5],
		[19, 5],
		[19, 5]
	],
	cower: [
		[16, 10],
		[17, 9],
		[15, 10],
		[16, 9]
	],
	mellow: [
		[16, 5],
		[16, 6],
		[16, 5],
		[17, 5]
	],
	bounce: [
		[16, 7],
		[16, 2],
		[16, 6],
		[16, 3]
	],
	startle: [
		[16, 8],
		[16, 9],
		[16, 2],
		[16, 5]
	],
	tug: [
		[16, 3],
		[17, 5],
		[15, 6],
		[16, 5]
	],
	giddy: [
		[17, 5],
		[16, 2],
		[15, 5],
		[16, 6]
	],
	ponder: [
		[17, 5],
		[17, 6],
		[17, 5],
		[15, 5],
		[15, 5],
		[16, 5]
	],
	aha: [
		[16, 7],
		[16, 3],
		[16, 3],
		[16, 6],
		[16, 5]
	],
	scratch: [
		[17, 5],
		[17, 6],
		[15, 5],
		[16, 5]
	]
};
