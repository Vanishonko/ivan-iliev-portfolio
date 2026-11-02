/**
 * Pip's voice lines, copied verbatim from the plugin's `copy.js` (`EN.line`),
 * which is the browser half's dictionary. No import from the plugin repo: this
 * is the portfolio's own copy of the words he actually says.
 *
 * The strings are deliberately untouched — punctuation, the spaced hyphen in
 * “Hey - the aerial!” and the capitalisation — so the site says what the
 * plugin says.
 */
export const PIP_LINES = {
	/** The bulb was pulled. He objects, briefly. */
	tug: ['Boing. That is attached, you know.', 'Hey - the aerial!', 'Easy on the antenna.'],
	/** A click (or Space / Enter) is a pat, not a poke. */
	pat: ['Hehe.', 'That tickles.', 'Hello to you too.', 'Again, again.'],
	/** Three pokes in a row put him on the floor. Verbatim from the plugin. */
	tipOver: [
		'Okay. I am down. I live here now.',
		'That is it. I am on the floor.',
		'Tell my story.'
	],
	/** Rare idle chatter, while he is left alone. */
	idle: ['Just having a look around.', 'Nice day for it.', 'I am here.', 'Nothing on fire.'],
	/** He has just nodded off. */
	slept: ['Zzz.', 'Just resting my eyes.'],
	/** Off duty, mid-animation. */
	toke: ['Hold on, one more.', 'Just a small one.', 'Do not mind me.', 'Right. Rolling one.'],
	/** The giggle / laugh poses. Available for reactions; see PipPlayground. */
	laugh: ['Hehehe. Sorry. Sorry.', 'I do not remember what was funny.', 'Pfft. Okay. Okay.']
} as const;

export type LineKind = keyof typeof PIP_LINES;

/** The last line picked per kind, so a two-line pool does not repeat itself. */
const lastIndex = new Map<LineKind, number>();

/**
 * One line for `kind`.
 *
 * Random, but never the same line twice in a row when the pool has more than
 * one entry: a repeated “Hehe.” reads as a stuck loop rather than a voice.
 */
export function pickLine(kind: LineKind): string {
	const pool: readonly string[] = PIP_LINES[kind];
	if (pool.length === 0) return '';

	const previous = lastIndex.get(kind) ?? -1;
	let index = Math.floor(Math.random() * pool.length);
	if (pool.length > 1 && index === previous) {
		// Step somewhere else in the pool rather than retrying at random.
		index = (index + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
	}
	lastIndex.set(kind, index);
	return pool[index] ?? '';
}
