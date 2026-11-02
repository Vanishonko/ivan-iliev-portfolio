<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { ANTENNA_ANCHORS } from '$lib/pip/anchors';
	import {
		antennaTip,
		createAntenna,
		drawAntenna as paintAntenna,
		pullAntenna,
		releaseAntenna,
		stepAntenna,
		type AntennaPoint,
		type AntennaState
	} from '$lib/pip/antenna';
	import {
		originForParticle,
		spawn as spawnParticles,
		update as updateParticles
	} from '$lib/pip/particles';
	import { drawParticles } from '$lib/pip/paintParticles';
	import { pickLine, type LineKind } from '$lib/pip/lines';

	/* ------------------------------------------------------------------ */
	/* Sprite data: 32×32 frames laid out horizontally, at 3× (96px).      */
	/* Timings are the plugin’s per-frame millisecond values.              */
	/* ------------------------------------------------------------------ */

	const ART = 32;
	const SCALE = 3;
	const SIZE = ART * SCALE;
	const EDGE = 14;

	/* The bulb's grab target, in cell pixels: the plugin's 28px handle at the
	   3× display scale (14px radius). The stem and the bulb are drawn by the
	   plugin's rig; only the pointer target is ours. */
	const ANTENNA_GRAB_CELLS = 14 / SCALE;

	const WALK_SPEED = 58; // CSS px per second
	const LOOK_FRAME_MS = 360;
	const LOOK_NOTICE_MS = 420;
	const IDLE_TO_SIT_MS = 6500;
	const SIT_TO_SLEEP_MS = 7500;
	const TOKE_CHANCE = 0.55;

	/* Speech. One line at a time: a new line replaces the current one, and the
	   bubble hides itself after {@link SPEECH_MS} whether or not he spoke again. */
	const SPEECH_MS = 2800;
	/* The bubble is clamped inside the stage, never the card. */
	const SPEECH_EDGE = 8;
	const SPEECH_MAX_WIDTH = 224;
	/* Only user-initiated lines (tug/pat) reach the polite live region, and no
	   more often than this: a screen reader should not repeat every pat. */
	const SPEECH_ANNOUNCE_GAP_MS = 1400;
	/* Idle chatter: the first chance comes after this long alone, then at most
	   one line per 25-30s. Failed rolls retry a few seconds later. */
	const IDLE_LINE_FIRST_MS = 9000;
	const IDLE_LINE_QUIET_MS = 7000;
	const IDLE_LINE_MIN_GAP_MS = 25000;
	const IDLE_LINE_MAX_GAP_MS = 30000;
	const IDLE_LINE_RETRY_MS = 3000;
	const IDLE_LINE_CHANCE = 0.5;
	/* A press that moves the bulb less than this many cell pixels is not a tug. */
	const TUG_PULL_CELLS = 1.5;
	/* Three pokes inside this window tip him over; the same window is the quiet
	   time after which the count starts again. */
	const POKE_WINDOW_MS = 4000;
	const POKE_LIMIT = 3;
	/* The tipped sheet runs 900 + 900 + 700 + 900 ms, then he lies there for a
	   beat before getting up (the sheet's last frame is held). */
	const TIP_DOWN_MS = 2700;
	const TIP_STATIC_MS = 2800;

	type Pose =
		| 'idle'
		| 'walk'
		| 'look'
		| 'sit'
		| 'sleep'
		| 'happy'
		| 'giggle'
		| 'jump'
		| 'startle'
		| 'aha'
		| 'toke'
		| 'tipped';

	type Reaction = Extract<Pose, 'happy' | 'giggle' | 'jump' | 'startle' | 'aha'>;

	type Speech = {
		kind: LineKind;
		text: string;
	};

	/* Shape of a particle between `spawn` and `update`; the module owns the
	   behaviour, this is only enough to type the array in the component. */
	type Particle = {
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

	type Sheet = {
		url: string;
		frames: number;
		ms: number[];
		loop: boolean;
		hold?: boolean;
	};

	const SHEETS: Record<Pose, Sheet> = {
		idle: {
			url: '/pip/idle.png',
			frames: 8,
			ms: [420, 420, 900, 420, 120, 160, 900, 420],
			loop: true
		},
		walk: {
			url: '/pip/walk.png',
			frames: 6,
			ms: [110, 110, 120, 110, 110, 120],
			loop: true
		},
		sit: {
			url: '/pip/sit.png',
			frames: 3,
			ms: [1200, 1200, 160],
			loop: false,
			hold: true
		},
		sleep: {
			url: '/pip/sleep.png',
			frames: 4,
			ms: [850, 850, 850, 850],
			loop: true
		},
		look: {
			url: '/pip/look.png',
			frames: 4,
			ms: [360, 360, 360, 360],
			loop: true
		},
		happy: {
			url: '/pip/happy.png',
			frames: 4,
			ms: [140, 130, 160, 180],
			loop: false
		},
		giggle: {
			url: '/pip/giggle.png',
			frames: 4,
			ms: [120, 140, 120, 180],
			loop: false
		},
		jump: {
			url: '/pip/jump.png',
			frames: 5,
			ms: [130, 120, 110, 120, 150],
			loop: false
		},
		startle: {
			url: '/pip/startle.png',
			frames: 4,
			ms: [100, 120, 120, 180],
			loop: false
		},
		aha: {
			url: '/pip/aha.png',
			frames: 5,
			ms: [110, 110, 130, 150, 200],
			loop: false
		},
		toke: {
			url: '/pip/toke.png',
			frames: 8,
			ms: [420, 460, 620, 320, 650, 520, 650, 700],
			loop: false
		},
		tipped: {
			url: '/pip/tipped.png',
			frames: 4,
			ms: [900, 900, 700, 900],
			loop: false,
			hold: true
		}
	};

	/** How long the tipped sheet runs before he has to lie there. */
	const TIP_SHEET_MS = SHEETS.tipped.ms.reduce((total, ms) => total + ms, 0);
	const TIP_RECOVER_MS = TIP_SHEET_MS + TIP_DOWN_MS;
	const JUMP_LANDING_FRAME = SHEETS.jump.frames - 1;

	const REACTIONS: Reaction[] = ['happy', 'giggle', 'jump', 'startle', 'aha'];

	const CAPTIONS: Record<Pose, string> = {
		idle: 'click him',
		walk: 'waddling over',
		look: 'he’s watching you',
		sit: 'taking a seat',
		sleep: 'asleep — click to wake',
		happy: 'he’s happy!',
		giggle: 'hehehe',
		jump: 'boing!',
		startle: '!',
		aha: 'aha!',
		toke: 'on a break',
		tipped: 'down. he lives here now'
	};

	const ANNOUNCEMENTS: Record<Reaction, string> = {
		happy: 'Pip is happy.',
		giggle: 'Pip is giggling.',
		jump: 'Pip jumps.',
		startle: 'Pip is startled.',
		aha: 'Pip had an idea.'
	};

	let { class: className = '' }: { class?: string } = $props();

	/* ------------------------------------------------------------------ */
	/* Reactive view state                                                 */
	/* ------------------------------------------------------------------ */

	let pose = $state<Pose>('idle');
	let frame = $state(0);
	let facing = $state<1 | -1>(1);
	let x = $state<number | null>(null);
	let stageWidth = $state(0);
	let stageHeight = $state(0);
	let announcement = $state('');
	let offDuty = $state(false);

	/* The visual bubble is always mounted (so its width can be measured and a
	   line can replace another with no DOM churn) and is only shown while
	   `speechShowing` is true. The spoken announcement is separate. */
	let speech = $state<Speech | null>(null);
	let speechShowing = $state(false);
	let speechWidth = $state(0);
	let spokenLine = $state('');

	const currentSheet = $derived(SHEETS[pose]);
	const caption = $derived(CAPTIONS[pose]);
	const spriteStyle = $derived(
		[
			`background-image:url(${currentSheet.url})`,
			`background-size:${currentSheet.frames * SIZE}px ${SIZE}px`,
			`background-position:-${frame * SIZE}px 0`
		].join(';')
	);

	/* The bubble is anchored above Pip's head and clamped to the stage: it
	   follows him while walking, but stops at the card's edge instead of
	   overflowing it. The tail keeps pointing at him when it does. */
	const speechMaxWidth = $derived(Math.min(SPEECH_MAX_WIDTH, Math.max(140, stageWidth - 16)));
	const speechPlacement = $derived.by(() => {
		const width = speechWidth;
		const half = (width > 0 ? width : speechMaxWidth) / 2;
		const pipCenter = (x ?? EDGE) + SIZE / 2;
		const min = SPEECH_EDGE + half;
		const max = Math.max(min, stageWidth - SPEECH_EDGE - half);
		const center = clamp(pipCenter, min, max);
		const shift = center - pipCenter;
		return {
			left: `calc(50% + ${Math.round(shift)}px)`,
			tail: width > 0 ? `${Math.round(clamp(width / 2 - shift, 10, width - 10))}px` : '50%'
		};
	});

	/* ------------------------------------------------------------------ */
	/* Internal, non-reactive state                                        */
	/* ------------------------------------------------------------------ */

	let rootEl = $state<HTMLElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let spriteEl = $state<HTMLDivElement | null>(null);
	let antennaEl = $state<HTMLCanvasElement | null>(null);
	let particleEl = $state<HTMLCanvasElement | null>(null);

	/* The particle layer, in stage pixels. The modules own the lifetimes and
	   the drawing; this owns only the canvas backing store and the tab pause. */
	let particleCtx: CanvasRenderingContext2D | null = null;
	let particles: Particle[] = [];
	let particleDirty = false;

	/* The plugin's rig: one state for the whole component. */
	let antennaCtx: CanvasRenderingContext2D | null = null;
	let antennaState: AntennaState | null = null;
	/* The pointer currently holding the bulb, in unmirrored cell coordinates. */
	let antennaPull: AntennaPoint | null = null;
	let antennaPointerId: number | null = null;
	let suppressClick = false;
	/* Where the bulb started this drag and the furthest it actually travelled:
	   the tug line is decided on release, never while the pointer is down. */
	let antennaStartTip: AntennaPoint | null = null;
	let antennaMaxPull = 0;

	/* Pip's previous position, for the rig's body-velocity lag. */
	let lastBodyX: number | null = null;
	let lastBodyAt = 0;

	let frameElapsed = 0;
	let holding = false;

	let lookSequence: number[] = [0, 1, 2, 3];
	let lookIndex = 0;
	let lookFrameElapsed = 0;
	let lookStartedAt = 0;

	let targetX: number | null = null;
	let pointerInside = false;

	let lastActivity = 0;
	let sitStartedAt = 0;

	/* Tipping over: when the floor pose began, and the recent poke times. */
	let tipStartedAt = 0;
	let pokeTimes: number[] = [];

	let lastReaction: Reaction | null = null;
	let staticReactionTimer: ReturnType<typeof setTimeout> | null = null;

	/* Speech timers and bookkeeping. */
	let speechTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSpokenAt = Number.NEGATIVE_INFINITY;
	let nextIdleLineCheckAt = 0;

	let rafId: number | null = null;
	let lastTimestamp = 0;
	let pausedAt = 0;
	let documentVisible = true;
	let inView = true;
	let reducedMotion = false;

	/* ------------------------------------------------------------------ */
	/* Helpers                                                             */
	/* ------------------------------------------------------------------ */

	function clamp(value: number, min: number, max: number): number {
		return Math.min(Math.max(value, min), Math.max(min, max));
	}

	function maxLeft(): number {
		return Math.max(EDGE, stageWidth - SIZE - EDGE);
	}

	function isReaction(value: Pose): value is Reaction {
		return (REACTIONS as string[]).includes(value);
	}

	function setPose(next: Pose, startFrame = 0): void {
		pose = next;
		frame = startFrame;
		frameElapsed = 0;
		holding = false;
	}

	function announce(message: string): void {
		announcement = message;
	}

	/* ------------------------------------------------------------------ */
	/* Particles                                                          */
	/* ------------------------------------------------------------------ */

	type ParticleOrigin = {
		x: number;
		y: number;
		spreadX: number;
		spreadY: number;
	};

	/**
	 * The particle canvas in viewport pixels.
	 *
	 * Its top-left is the drawing origin: using the stage box instead would be a
	 * border-width off, because the canvas sits inside the stage's border.
	 */
	function particleCanvasRect(): DOMRect | null {
		return particleEl?.getBoundingClientRect() ?? null;
	}

	/**
	 * Where an emitter should leave from, in stage pixels.
	 *
	 * The model's `originForParticle` speaks in viewport pixels and knows which
	 * emitters are thoughts (above the head) and which are physical (at the
	 * body). The stage canvas is its own little viewport, so the box is shifted
	 * into canvas space here.
	 */
	function particleOrigin(kind: string): ParticleOrigin | null {
		const canvas = particleCanvasRect();
		const sprite = spriteEl?.getBoundingClientRect();
		if (!canvas || !sprite) return null;
		const origin = originForParticle(kind, sprite, { x: sprite.left, y: sprite.top });
		return {
			x: origin.x - canvas.left,
			y: origin.y - canvas.top,
			spreadX: origin.spreadX,
			spreadY: origin.spreadY
		};
	}

	/** The bulb's current position, in stage pixels: the ring leaves from there. */
	function antennaTipOrigin(): ParticleOrigin | null {
		const canvas = particleCanvasRect();
		const sprite = spriteEl?.getBoundingClientRect();
		if (!canvas || !sprite) return null;
		const tip = antennaTip(ensureAntenna());
		const localX = facing === 1 ? tip.x : ART - tip.x;
		return {
			x: sprite.left - canvas.left + (localX / ART) * sprite.width,
			y: sprite.top - canvas.top + (tip.y / ART) * sprite.height,
			spreadX: 2,
			spreadY: 2
		};
	}

	/** The floor under him, for a fall rather than a thought. */
	function floorOrigin(): ParticleOrigin | null {
		const canvas = particleCanvasRect();
		const sprite = spriteEl?.getBoundingClientRect();
		if (!canvas || !sprite) return null;
		return {
			x: sprite.left - canvas.left + sprite.width / 2,
			y: sprite.top - canvas.top + sprite.height * 0.82,
			spreadX: sprite.width * 0.22,
			spreadY: 4
		};
	}

	/**
	 * One burst from the plugin's particle model.
	 *
	 * Reduced motion spawns nothing at all — the same promise the CSS makes.
	 * The module chooses the count, the styles and the lifetime; the caller only
	 * supplies the emitter and the origin.
	 */
	function spawnParticle(kind: string, origin: ParticleOrigin | null): void {
		if (!browser || reducedMotion || origin === null) return;
		particles = spawnParticles(particles, {
			kind,
			x: origin.x,
			y: origin.y,
			now: performance.now(),
			spreadX: origin.spreadX,
			spreadY: origin.spreadY
		}) as Particle[];
		particleDirty = true;
	}

	function emitParticle(kind: string): void {
		spawnParticle(kind, particleOrigin(kind));
	}

	/**
	 * Step and paint the layer.
	 *
	 * `update` returns new particles each frame; the painter fades each one, so
	 * it is called per particle to carry the model's own `alpha` through
	 * `globalAlpha` (the painter deliberately leaves that to its caller).
	 */
	function paintParticles(): void {
		const canvas = particleEl;
		if (!canvas) return;
		if (particleCtx === null) particleCtx = canvas.getContext('2d');
		const context = particleCtx;
		if (!context) return;

		context.setTransform(1, 0, 0, 1, 0, 0);
		context.globalAlpha = 1;
		context.clearRect(0, 0, canvas.width, canvas.height);
		for (const particle of particles) {
			context.globalAlpha = Math.max(0, Math.min(1, particle.alpha ?? 1));
			drawParticles(context, [particle]);
		}
		context.globalAlpha = 1;
		particleDirty = particles.length > 0;
	}

	function stepParticles(now: number): void {
		if (reducedMotion) {
			if (particles.length > 0) {
				particles = [];
				particleDirty = true;
			}
		} else {
			const stepped = updateParticles(particles, now);
			particles = stepped.particles as Particle[];
			if (particles.length > 0) particleDirty = true;
		}
		if (particles.length > 0 || particleDirty) paintParticles();
	}

	/* ------------------------------------------------------------------ */
	/* Speech                                                              */
	/* ------------------------------------------------------------------ */

	/**
	 * Say one line, replacing whatever he was saying.
	 *
	 * The bubble hides itself after {@link SPEECH_MS}. Only `tug`, `pat` and
	 * `tipOver` are announced through the polite live region: idle chatter,
	 * sleep and the off-duty lines are ambient, and reading them aloud would be
	 * noise. The announcement is throttled separately from the bubble, so rapid
	 * pats still change the words on screen without re-reading them every time.
	 */
	function say(kind: LineKind, options: { announce?: boolean } = {}): void {
		if (!browser) return;
		const text = pickLine(kind);
		if (!text) return;

		speech = { kind, text };
		speechShowing = true;
		if (speechTimer !== null) clearTimeout(speechTimer);
		speechTimer = setTimeout(() => {
			speechTimer = null;
			speechShowing = false;
			/* Clearing lets an identical line announce again later; the removal
			   itself is not announced. */
			spokenLine = '';
		}, SPEECH_MS);

		if (options.announce) {
			const now = performance.now();
			if (now - lastSpokenAt < SPEECH_ANNOUNCE_GAP_MS) return;
			lastSpokenAt = now;
			spokenLine = `Pip says: ${text}`;
		}
	}

	function nextIdleGap(): number {
		return IDLE_LINE_MIN_GAP_MS + Math.random() * (IDLE_LINE_MAX_GAP_MS - IDLE_LINE_MIN_GAP_MS);
	}

	/**
	 * Rare idle chatter.
	 *
	 * The scheduler is a check time, not a per-frame chance: a failed roll costs
	 * {@link IDLE_LINE_RETRY_MS}, a line costs a full 25-30s, so one line per
	 * quiet spell is the ceiling. He only talks while idling or sitting, and
	 * only after {@link IDLE_LINE_QUIET_MS} without interaction.
	 */
	function maybeIdleLine(now: number): void {
		if (!browser) return;
		/* A held antenna is an interaction in progress: chatter would read as
		   him talking over the drag. */
		if (antennaPointerId !== null) return;
		if (pose !== 'idle' && pose !== 'sit') return;
		if (now - lastActivity < IDLE_LINE_QUIET_MS) return;
		if (now < nextIdleLineCheckAt) return;
		if (speechShowing || Math.random() > IDLE_LINE_CHANCE) {
			nextIdleLineCheckAt = now + IDLE_LINE_RETRY_MS;
			return;
		}
		nextIdleLineCheckAt = now + nextIdleGap();
		say('idle');
	}

	/* ------------------------------------------------------------------ */
	/* Mood / behaviour                                                    */
	/* ------------------------------------------------------------------ */

	function lookFramesForCursor(): number[] {
		if (x === null || targetX === null) return [3];
		const dx = targetX - x;
		if (Math.abs(dx) < 10) return [3];
		return dx > 0 ? [0, 1] : [2];
	}

	function enterLook(at = performance.now()): void {
		lookSequence = lookFramesForCursor();
		lookIndex = 0;
		lookFrameElapsed = 0;
		lookStartedAt = at;
		setPose('look', lookSequence[0]);
		if (x !== null && targetX !== null) facing = targetX >= x ? 1 : -1;
	}

	function startWalk(): void {
		if (x === null || targetX === null) {
			enterLook();
			return;
		}
		if (Math.abs(targetX - x) <= 2) {
			enterLook();
			return;
		}
		setPose('walk');
		facing = targetX >= x ? 1 : -1;
	}

	function startSit(now: number): void {
		setPose('sit');
		sitStartedAt = now;
	}

	function startSleep(): void {
		setPose('sleep');
		announce('Pip fell asleep.');
		say('slept');
	}

	function startToke(): void {
		if (reducedMotion) return;
		setPose('toke');
		announce('Pip is taking a break.');
		say('toke');
		syncLoop();
	}

	function endToke(): void {
		lastActivity = performance.now();
		setPose('idle');
		announce('Pip is back from his break.');
	}

	function toggleMood(): void {
		offDuty = !offDuty;
		lastActivity = performance.now();

		if (!offDuty && pose === 'toke') {
			setPose('idle');
			announce('Pip is back on duty.');
		}

		if (!reducedMotion) syncLoop();
	}

	function endReaction(): void {
		lastActivity = performance.now();
		if (pointerInside && targetX !== null) {
			if (Math.abs(targetX - x!) > 8) startWalk();
			else enterLook();
		} else {
			setPose('idle');
		}
	}

	/**
	 * Count one poke and answer whether this one is the straw.
	 *
	 * The window is a rolling one: times older than {@link POKE_WINDOW_MS} fall
	 * out, so two pokes and a long pause are two pokes again. The counter is
	 * cleared when he tips and when he gets up.
	 */
	function registerPoke(now: number): boolean {
		pokeTimes = pokeTimes.filter((at) => now - at <= POKE_WINDOW_MS);
		pokeTimes.push(now);
		return pokeTimes.length >= POKE_LIMIT;
	}

	/** Three pokes in the window: the floor. */
	function startTipOver(now: number): void {
		pokeTimes = [];
		tipStartedAt = now;
		lastActivity = now;
		setPose('tipped');
		announce('Pip tips over.');
		say('tipOver', { announce: true });
		spawnParticle('smoke', floorOrigin());

		if (reducedMotion) {
			/* No animation loop, so show the last frame and use a timer. */
			setPose('tipped', SHEETS.tipped.frames - 1);
			if (staticReactionTimer !== null) clearTimeout(staticReactionTimer);
			staticReactionTimer = setTimeout(() => {
				staticReactionTimer = null;
				endTipOver();
			}, TIP_STATIC_MS);
			return;
		}

		syncLoop();
	}

	function endTipOver(): void {
		lastActivity = performance.now();
		pokeTimes = [];
		setPose('idle');
		announce('Pip is back up.');
	}

	function triggerReaction(): void {
		/* Already on the floor: no reaction, and no further pokes stack up. */
		if (pose === 'tipped') return;

		const now = performance.now();
		lastActivity = now;

		/* A click that wakes him is not one of the three: he must not tip over
		   out of sleep. The reaction itself still plays, exactly as before. */
		if (pose !== 'sleep' && registerPoke(now)) {
			startTipOver(now);
			return;
		}

		emitParticle('cheer');

		const options = REACTIONS.filter((reaction) => reaction !== lastReaction);
		const reaction = options[Math.floor(Math.random() * options.length)] ?? 'happy';
		lastReaction = reaction;
		announce(ANNOUNCEMENTS[reaction]);
		/* A click, Space or Enter is a pat. Pat lines always win over the
		   optional laugh line for the giggle pose: a click should read as a
		   greeting, not as him laughing at something else. */
		say('pat', { announce: true });

		if (reducedMotion) {
			setPose(reaction, Math.min(1, SHEETS[reaction].frames - 1));
			if (staticReactionTimer !== null) clearTimeout(staticReactionTimer);
			staticReactionTimer = setTimeout(() => {
				staticReactionTimer = null;
				setPose('idle');
			}, 1400);
			return;
		}

		setPose(reaction);
	}

	/* ------------------------------------------------------------------ */
	/* Animation                                                           */
	/* ------------------------------------------------------------------ */

	function advanceLook(dt: number): void {
		if (lookSequence.length < 2) {
			lookFrameElapsed = 0;
			return;
		}
		lookFrameElapsed += dt;
		let guard = 0;
		while (lookFrameElapsed >= LOOK_FRAME_MS && guard < 8) {
			lookFrameElapsed -= LOOK_FRAME_MS;
			lookIndex = (lookIndex + 1) % lookSequence.length;
			frame = lookSequence[lookIndex];
			guard += 1;
		}
	}

	function advanceSheet(dt: number): void {
		if (pose === 'look') {
			advanceLook(dt);
			return;
		}

		if (holding) return;

		const sheet = SHEETS[pose];
		frameElapsed += dt;
		let guard = 0;

		while (guard < 8) {
			guard += 1;
			const duration = sheet.ms[frame] ?? 1000;
			if (frameElapsed < duration) break;
			frameElapsed -= duration;

			if (frame < sheet.frames - 1) {
				frame += 1;
				/* The jump's last frame is the landing: one small puff of dust. */
				if (pose === 'jump' && frame === JUMP_LANDING_FRAME) emitParticle('land');
				continue;
			}

			if (sheet.loop) {
				frame = 0;
				continue;
			}

			if (sheet.hold) {
				holding = true;
				frameElapsed = 0;
				break;
			}

			if (isReaction(pose)) endReaction();
			else if (pose === 'toke') endToke();
			else setPose('idle');
			return;
		}
	}

	function updateWalk(dt: number): void {
		if (x === null || targetX === null) {
			enterLook();
			return;
		}

		const dx = targetX - x;
		if (Math.abs(dx) <= 1.5) {
			x = targetX;
			enterLook();
			return;
		}

		const direction: 1 | -1 = dx > 0 ? 1 : -1;
		if (facing !== direction) facing = direction;

		const step = Math.min(Math.abs(dx), (WALK_SPEED * dt) / 1000);
		x = clamp(x + direction * step, EDGE, maxLeft());
	}

	function updateMood(now: number): void {
		if (pose === 'idle') {
			if (!pointerInside && now - lastActivity >= IDLE_TO_SIT_MS) {
				if (offDuty && Math.random() < TOKE_CHANCE) startToke();
				else startSit(now);
			}
			return;
		}

		if (pose === 'sit') {
			if (!pointerInside && now - sitStartedAt >= SIT_TO_SLEEP_MS) {
				if (offDuty && Math.random() < TOKE_CHANCE) startToke();
				else startSleep();
			}
			return;
		}

		if (pose === 'look') {
			const farFromTarget = targetX !== null && x !== null && Math.abs(targetX - x) > 8;
			if (farFromTarget && now - lookStartedAt >= LOOK_NOTICE_MS) {
				startWalk();
				return;
			}
			if (!pointerInside && now - lookStartedAt >= 750) {
				setPose('idle');
			}
		}
	}

	function update(dt: number, now: number): void {
		advanceSheet(dt);
		/* The sheet plays once and holds its last frame; the floor-time clock
		   (rather than the frame clock) decides when he gets up. */
		if (pose === 'tipped' && now - tipStartedAt >= TIP_RECOVER_MS) endTipOver();
		if (pose === 'walk') updateWalk(dt);
		updateMood(now);
		maybeIdleLine(now);
	}

	function tick(timestamp: number): void {
		rafId = null;
		if (!lastTimestamp) lastTimestamp = timestamp;
		const dt = Math.min(120, Math.max(0, timestamp - lastTimestamp));
		lastTimestamp = timestamp;

		if (x !== null) update(dt, timestamp);
		stepAntennaFrame(dt, timestamp);
		drawAntenna();
		stepParticles(timestamp);

		if (browser && !reducedMotion && documentVisible && inView) {
			rafId = requestAnimationFrame(tick);
		}
	}

	function startLoop(): void {
		if (!browser || rafId !== null) return;

		if (pausedAt !== 0) {
			const pausedFor = performance.now() - pausedAt;
			if (lastActivity > 0) lastActivity += pausedFor;
			if (sitStartedAt > 0) sitStartedAt += pausedFor;
			if (lookStartedAt > 0) lookStartedAt += pausedFor;
			if (nextIdleLineCheckAt > 0) nextIdleLineCheckAt += pausedFor;
			if (tipStartedAt > 0) tipStartedAt += pausedFor;
			/* Freeze every particle's age too: a tab that was hidden for a
			   minute should not skip the whole burst on the first frame back. */
			for (const particle of particles) particle.born += pausedFor;
			pausedAt = 0;
		}

		lastTimestamp = 0;
		rafId = requestAnimationFrame(tick);
	}

	function stopLoop(): void {
		const wasRunning = rafId !== null;
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = null;
		lastTimestamp = 0;
		if (wasRunning && pausedAt === 0) pausedAt = performance.now();
	}

	function syncLoop(): void {
		if (browser && !reducedMotion && documentVisible && inView) startLoop();
		else stopLoop();
	}

	/* ------------------------------------------------------------------ */
	/* Antenna — the plugin’s rig, on the same 32×32 art grid              */
	/* ------------------------------------------------------------------ */

	/**
	 * The base of the stalk for the current pose and frame.
	 *
	 * `ANTENNA_ANCHORS` is authored in unmirrored cell pixels. The whole figure
	 * is mirrored by CSS when Pip faces left, so these stay unmirrored here —
	 * exactly the plugin’s split between the rig and its flip layer.
	 */
	function antennaAnchor(): AntennaPoint {
		const anchors = ANTENNA_ANCHORS[pose] ?? ANTENNA_ANCHORS.idle;
		const point = anchors?.[frame] ?? anchors?.[0] ?? [16, 5];
		return { x: point[0], y: point[1] };
	}

	function ensureAntenna(): AntennaState {
		if (antennaState === null) {
			antennaState = createAntenna({ anchor: antennaAnchor(), rest: pose });
		}
		return antennaState;
	}

	/**
	 * Pip’s motion in local cell pixels per second.
	 *
	 * The rig works in 32-cell units, so a CSS movement is divided by the display
	 * scale. The sign is negated while facing left because the body is mirrored
	 * but the rig is not: the antenna must trail behind the art, not ahead of it.
	 */
	function antennaBodyVelocity(now: number): AntennaPoint {
		if (x === null) return { x: 0, y: 0 };
		if (lastBodyX === null) {
			lastBodyX = x;
			lastBodyAt = now;
			return { x: 0, y: 0 };
		}
		const elapsed = (now - lastBodyAt) / 1000;
		const moved = x - lastBodyX;
		lastBodyX = x;
		lastBodyAt = now;
		if (!(elapsed > 0) || elapsed > 0.25) return { x: 0, y: 0 };
		// A resize, a remount, or one absurd frame is a layout jump, not a walk.
		if (Math.abs(moved) > SIZE * 2) return { x: 0, y: 0 };
		const velocityX = moved / elapsed / SCALE;
		return { x: facing === 1 ? velocityX : -velocityX, y: 0 };
	}

	function stepAntennaFrame(dt: number, now: number): void {
		if (!browser) return;
		const state = ensureAntenna();
		stepAntenna(state, {
			dt: dt / 1000,
			anchor: antennaAnchor(),
			rest: pose,
			bodyVelocity: antennaBodyVelocity(now)
		});
		// The pointer owns the pose during a pull, but the crown can move under
		// it; re-aim after the anchor update so the bulb stays with the pointer.
		if (state.dragged && antennaPull !== null) {
			pullAntenna(state, antennaPull, { now: performance.now() });
		}
	}

	/**
	 * Reduced motion: no oscillation, just the current pose’s rest. The rest is
	 * applied by hand because the module’s spring would otherwise animate into
	 * it; a final zero-velocity step applies the rig’s own cell clamp.
	 */
	function stepAntennaStatic(): void {
		if (!browser) return;
		const state = ensureAntenna();
		const anchor = antennaAnchor();
		stepAntenna(state, { dt: 1 / 240, anchor, rest: pose, bodyVelocity: { x: 0, y: 0 } });
		state.angle = state.rest.angle;
		state.length = state.rest.length;
		state.angularVelocity = 0;
		state.lengthVelocity = 0;
		stepAntenna(state, { dt: 1 / 240, anchor, rest: pose, bodyVelocity: { x: 0, y: 0 } });
	}

	function drawAntenna(): void {
		if (!browser) return;
		const canvas = antennaEl;
		if (!canvas) return;
		if (!antennaCtx) antennaCtx = canvas.getContext('2d');
		const context = antennaCtx;
		if (!context) return;
		paintAntenna(context, ensureAntenna(), { cell: ART });
	}

	/**
	 * A screen pointer in the rig’s unmirrored cell coordinates.
	 *
	 * The figure (sprite + antenna) is mirrored with `scaleX(-1)` while Pip
	 * faces left, exactly like the plugin’s flip layer, so the pointer has to be
	 * mirrored back before the rig sees it. On the 1px grid that is the familiar
	 * `31 - x`; continuous coordinates use `ART - x` so the centre of the cell
	 * maps to itself, matching the plugin’s `antennaPointFromEvent`.
	 */
	function antennaPointFromPointer(event: PointerEvent): AntennaPoint | null {
		const rect = spriteEl?.getBoundingClientRect();
		if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
		const pointerX = ((event.clientX - rect.left) / rect.width) * ART;
		const pointerY = ((event.clientY - rect.top) / rect.height) * ART;
		if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;
		return { x: facing === 1 ? pointerX : ART - pointerX, y: pointerY };
	}

	function pointerInsideSprite(event: PointerEvent): boolean {
		const rect = spriteEl?.getBoundingClientRect();
		if (!rect) return false;
		return (
			event.clientX >= rect.left &&
			event.clientX <= rect.right &&
			event.clientY >= rect.top &&
			event.clientY <= rect.bottom
		);
	}

	function updateAntennaPull(event: PointerEvent): void {
		if (antennaPointerId === null || event.pointerId !== antennaPointerId) return;
		const point = antennaPointFromPointer(event);
		if (point === null) return;
		const state = ensureAntenna();
		antennaPull = point;
		pullAntenna(state, point, { now: performance.now() });

		/* Track how far the bulb actually travelled, not where the pointer ended
		   up: a drag out and back is still a tug, and the line is decided on
		   release. Nothing is said while the pointer is down. */
		if (antennaStartTip !== null) {
			const tip = antennaTip(state);
			antennaMaxPull = Math.max(
				antennaMaxPull,
				Math.hypot(tip.x - antennaStartTip.x, tip.y - antennaStartTip.y)
			);
		}

		drawAntenna();
	}

	/**
	 * A press on the bulb starts the plugin’s pointer drag. The target is the
	 * same 28px handle the plugin uses (14px radius at 3×), measured around the
	 * current tip in local cell space.
	 */
	function handleAntennaPointerDown(event: PointerEvent): void {
		if (reducedMotion || event.button !== 0) return;
		if (antennaPointerId !== null) return;
		suppressClick = false;
		if (!pointerInsideSprite(event)) return;

		const point = antennaPointFromPointer(event);
		if (point === null) return;
		const state = ensureAntenna();
		const tip = antennaTip(state);
		if (Math.hypot(tip.x - point.x, tip.y - point.y) > ANTENNA_GRAB_CELLS) return;

		event.preventDefault();
		// A press on the bulb is not a pat; the plugin’s handle stops the click too.
		suppressClick = true;
		antennaPointerId = event.pointerId;
		antennaPull = point;
		antennaStartTip = tip;
		antennaMaxPull = 0;
		try {
			stageEl?.setPointerCapture(event.pointerId);
		} catch {
			/* Capture is a convenience; the pointer events still arrive. */
		}
		pullAntenna(state, point, { now: performance.now() });
		lastActivity = performance.now();
		syncLoop();
		drawAntenna();
	}

	/**
	 * End the drag and say one line if it was a real tug.
	 *
	 * The bulb has to have moved more than {@link TUG_PULL_CELLS} at some point
	 * during the drag. That is the whole speech rule: no pointermove here ever
	 * calls `say`, so a hold that never releases stays silent.
	 */
	function endAntennaPull(event: PointerEvent | null, options: { speak?: boolean } = {}): void {
		if (antennaPointerId === null) return;
		const pulled = antennaMaxPull > TUG_PULL_CELLS;
		/* The rings leave from where the bulb is at the instant of release. */
		const ringOrigin = pulled ? antennaTipOrigin() : null;
		antennaPointerId = null;
		antennaPull = null;
		antennaStartTip = null;
		antennaMaxPull = 0;
		if (event !== null) {
			try {
				if (stageEl?.hasPointerCapture(event.pointerId)) {
					stageEl.releasePointerCapture(event.pointerId);
				}
			} catch {
				/* Already released, or the browser never granted capture. */
			}
		}
		releaseAntenna(ensureAntenna(), { now: performance.now() });
		drawAntenna();
		lastActivity = performance.now();

		if (pulled && options.speak !== false) {
			say('tug', { announce: true });
			spawnParticle('ring', ringOrigin);
		}
	}

	function handleAntennaPointerUp(event: PointerEvent): void {
		if (antennaPointerId === null || event.pointerId !== antennaPointerId) return;
		event.preventDefault();
		endAntennaPull(event);
		lastActivity = performance.now();
	}

	function handleAntennaPointerCancel(event: PointerEvent): void {
		if (antennaPointerId === null || event.pointerId !== antennaPointerId) return;
		endAntennaPull(event);
	}

	/* ------------------------------------------------------------------ */
	/* Interaction                                                         */
	/* ------------------------------------------------------------------ */

	function pointToSprite(clientX: number): number {
		const rect = stageEl?.getBoundingClientRect();
		if (!rect) return x ?? EDGE;
		return clamp(clientX - rect.left - SIZE / 2, EDGE, maxLeft());
	}

	function handlePointer(event: PointerEvent): void {
		// A held bulb owns the pointer: keep aiming the rig and leave the body
		// alone, so the crown does not wander out from under the drag.
		if (antennaPointerId !== null) {
			if (event.pointerId === antennaPointerId) updateAntennaPull(event);
			return;
		}
		if (reducedMotion || event.pointerType === 'touch') return;
		if (!stageEl) return;

		const now = performance.now();
		const wasSleeping = pose === 'sleep';
		lastActivity = now;
		pointerInside = true;
		targetX = pointToSprite(event.clientX);

		if (pose === 'idle') {
			enterLook(now);
		} else if (pose === 'sit' || pose === 'sleep') {
			if (wasSleeping) announce('Pip wakes up.');
			enterLook(now);
		} else if (pose === 'look') {
			facing = targetX >= (x ?? targetX) ? 1 : -1;
			const nextLook = lookFramesForCursor();
			if (nextLook.join(',') !== lookSequence.join(',')) {
				lookSequence = nextLook;
				lookIndex = 0;
				lookFrameElapsed = 0;
				frame = lookSequence[0];
			}
		} else if (pose === 'walk') {
			facing = targetX >= (x ?? targetX) ? 1 : -1;
		}

		syncLoop();
	}

	function handlePointerLeave(): void {
		pointerInside = false;
		lastActivity = performance.now();
	}

	function handleStageClick(event: MouseEvent): void {
		if (event.detail === 0) return;

		// The press that started on the bulb is a pull, not a pat.
		if (suppressClick) {
			suppressClick = false;
			return;
		}

		const pointerType = (event as PointerEvent).pointerType;
		const onTouch = pointerType === 'touch';
		const spriteBox = spriteEl?.getBoundingClientRect();
		const onPip =
			spriteBox !== undefined &&
			event.clientX >= spriteBox.left - 4 &&
			event.clientX <= spriteBox.right + 4 &&
			event.clientY >= spriteBox.top - 4 &&
			event.clientY <= spriteBox.bottom + 4;

		lastActivity = performance.now();
		if (!onTouch) pointerInside = true;

		if (onPip) {
			triggerReaction();
			return;
		}

		if (reducedMotion) return;

		targetX = pointToSprite(event.clientX);

		if (pose === 'idle' || pose === 'sit' || pose === 'sleep') {
			enterLook(lastActivity);
		}
		syncLoop();
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key !== ' ' && event.key !== 'Enter' && event.key !== 'Spacebar') return;
		if (event.repeat) {
			event.preventDefault();
			return;
		}
		event.preventDefault();
		lastActivity = performance.now();
		triggerReaction();
	}

	function handleFocus(): void {
		lastActivity = performance.now();
		if (reducedMotion) return;
		if (pose === 'idle' || pose === 'sit' || pose === 'sleep') enterLook();
		syncLoop();
	}

	function handleReducedMotionChange(event: MediaQueryListEvent): void {
		reducedMotion = event.matches;
		if (reducedMotion) {
			if (staticReactionTimer !== null) {
				clearTimeout(staticReactionTimer);
				staticReactionTimer = null;
			}
			endAntennaPull(null, { speak: false });
			setPose('idle', 0);
			pokeTimes = [];
			tipStartedAt = 0;
			antennaState = null;
			stopLoop();
			stepAntennaStatic();
			drawAntenna();
			/* Reduced motion means the particle layer empties instead of
			   finishing its bursts. */
			particles = [];
			particleDirty = false;
			paintParticles();
		} else {
			antennaState = null;
			syncLoop();
		}
	}

	/* Redraw outside the loop too: reduced motion and hidden tabs still get
	   a correct static antenna. */
	$effect(() => {
		if (!browser) return;
		if (reducedMotion) stepAntennaStatic();
		drawAntenna();
	});

	/* ------------------------------------------------------------------ */
	/* Lifecycle                                                           */
	/* ------------------------------------------------------------------ */

	onMount(() => {
		const root = rootEl;
		const stage = stageEl;
		if (!root || !stage) return;

		antennaCtx = antennaEl?.getContext('2d') ?? null;
		particleCtx = particleEl?.getContext('2d') ?? null;
		drawAntenna();

		lastActivity = performance.now();
		nextIdleLineCheckAt = lastActivity + IDLE_LINE_FIRST_MS;

		const measure = (): void => {
			stageWidth = stage.clientWidth;
			stageHeight = stage.clientHeight;
			x = x === null ? Math.max(EDGE, (stageWidth - SIZE) / 2) : clamp(x, EDGE, maxLeft());
			if (targetX !== null) targetX = clamp(targetX, EDGE, maxLeft());
		};
		measure();

		const resizeObserver = new ResizeObserver(measure);
		resizeObserver.observe(stage);

		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = mediaQuery.matches;
		mediaQuery.addEventListener('change', handleReducedMotionChange);

		documentVisible = !document.hidden;
		const onVisibilityChange = (): void => {
			documentVisible = !document.hidden;
			syncLoop();
		};
		document.addEventListener('visibilitychange', onVisibilityChange);

		const intersectionObserver = new IntersectionObserver(
			(entries) => {
				inView = entries.some((entry) => entry.isIntersecting);
				syncLoop();
			},
			{ threshold: 0.05 }
		);
		intersectionObserver.observe(root);

		syncLoop();

		return () => {
			resizeObserver.disconnect();
			intersectionObserver.disconnect();
			mediaQuery.removeEventListener('change', handleReducedMotionChange);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			stopLoop();
			if (staticReactionTimer !== null) {
				clearTimeout(staticReactionTimer);
				staticReactionTimer = null;
			}
			if (speechTimer !== null) {
				clearTimeout(speechTimer);
				speechTimer = null;
			}
		};
	});
</script>

<section
	class="pip-card rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md {className}"
	bind:this={rootEl}
>
	<header class="pip-head">
		<span class="pip-name">
			<span class="pip-dot" data-asleep={pose === 'sleep'} aria-hidden="true"></span>
			pip
		</span>
		<span class="pip-meta">32 × 32</span>
	</header>

	<div
		class="pip-stage"
		data-pose={pose}
		bind:this={stageEl}
		role="button"
		tabindex="0"
		aria-label="Pip the pixel creature. Click him, or press Enter or Space, for a reaction."
		onpointerenter={handlePointer}
		onpointermove={handlePointer}
		onpointerdown={handleAntennaPointerDown}
		onpointerup={handleAntennaPointerUp}
		onpointercancel={handleAntennaPointerCancel}
		onlostpointercapture={handleAntennaPointerCancel}
		onpointerleave={handlePointerLeave}
		onclick={handleStageClick}
		onkeydown={handleKeyDown}
		onfocus={handleFocus}
	>
		<div class="pip-ground" aria-hidden="true"></div>

		<div
			class="pip-mover"
			style:left={x === null ? '50%' : '0px'}
			style:transform={x === null ? 'translateX(-50%)' : `translate3d(${x}px, 0, 0)`}
		>
			<div class="pip-aura" aria-hidden="true"></div>
			<div class="pip-shadow" aria-hidden="true"></div>
			<div class="pip-figure" style:transform={facing === 1 ? 'none' : 'scaleX(-1)'}>
				<div class="pip-sprite" bind:this={spriteEl} style={spriteStyle} aria-hidden="true"></div>
				<canvas
					class="pip-antenna"
					bind:this={antennaEl}
					width={ART}
					height={ART}
					aria-hidden="true"
				></canvas>
			</div>

			<!-- The visual bubble is decorative: its words are announced from the
			     live region below, and only for user-initiated lines. It stays
			     mounted so a new line replaces the old one without DOM churn and
			     its width can be measured for the edge clamp. -->
			<div
				class="pip-speech"
				data-showing={speechShowing ? 'true' : 'false'}
				data-kind={speech?.kind ?? 'idle'}
				style:left={speechPlacement.left}
				style:max-width={`${speechMaxWidth}px`}
				bind:offsetWidth={speechWidth}
				aria-hidden="true"
			>
				<span class="pip-speech-text">{speech?.text ?? ''}</span>
				<span class="pip-speech-tail" style:left={speechPlacement.tail}></span>
			</div>
		</div>

		<!-- Particle layer: stage-sized, transparent, and never a pointer target.
		     Its backing store is the displayed CSS size, so the module's 1-3px
		     squares stay on the pixel grid. -->
		<canvas
			class="pip-particles"
			bind:this={particleEl}
			width={Math.max(1, stageWidth)}
			height={Math.max(1, stageHeight)}
			aria-hidden="true"
		></canvas>
	</div>

	<footer class="pip-foot">
		<p class="pip-caption" aria-hidden="true">{caption}</p>
		<div class="pip-controls">
			<button
				type="button"
				class="pip-mood"
				data-mood={offDuty ? 'off' : 'on'}
				aria-pressed={offDuty}
				title="toggle on duty / off duty"
				onclick={toggleMood}
			>
				<span class="pip-mood-dot" aria-hidden="true"></span>
				{offDuty ? 'off duty' : 'on duty'}
			</button>
			<span class="pip-key" aria-hidden="true"><kbd>space</kbd> / <kbd>enter</kbd></span>
		</div>
	</footer>

	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
	<p class="sr-only" aria-live="polite" aria-atomic="true">{spokenLine}</p>
</section>

<style>
	.pip-card {
		position: relative;
		overflow: hidden;
		isolation: isolate;
		color: #f5f4f1;
		font-family: 'Courier Prime', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.04),
			0 24px 60px -42px rgba(124, 58, 237, 0.55);
	}

	.pip-card::after {
		content: '';
		position: absolute;
		inset: -40% 30% auto;
		height: 70%;
		pointer-events: none;
		background: radial-gradient(ellipse at center, rgba(167, 139, 250, 0.12), transparent 70%);
		filter: blur(18px);
		z-index: -1;
	}

	.pip-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 1rem 0.65rem;
		font-size: 0.625rem;
		line-height: 1;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(245, 244, 241, 0.55);
	}

	.pip-name {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
	}

	.pip-dot {
		width: 5px;
		height: 5px;
		border-radius: 1px;
		background: #c4b5fd;
		box-shadow: 0 0 8px rgba(167, 139, 250, 0.9);
		animation: pip-dot-pulse 3.6s ease-in-out infinite;
	}

	.pip-dot[data-asleep='true'] {
		background: #64748b;
		box-shadow: none;
		animation: none;
	}

	.pip-meta {
		color: rgba(245, 244, 241, 0.28);
		letter-spacing: 0.16em;
	}

	.pip-stage {
		position: relative;
		height: 200px;
		overflow: hidden;
		border-top: 1px solid rgba(255, 255, 255, 0.06);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background:
			radial-gradient(
				90% 85% at 50% 102%,
				rgba(124, 58, 237, 0.2) 0%,
				rgba(124, 58, 237, 0.05) 48%,
				transparent 74%
			),
			linear-gradient(
				180deg,
				rgba(7, 9, 18, 0.28) 0%,
				rgba(7, 9, 18, 0.08) 58%,
				rgba(7, 9, 18, 0.34) 100%
			);
		cursor: pointer;
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		outline: none;
		-webkit-tap-highlight-color: transparent;
	}

	.pip-stage::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		opacity: 0.75;
		background-image:
			radial-gradient(circle at 12% 26%, rgba(245, 244, 241, 0.7) 0 0.7px, transparent 1.3px),
			radial-gradient(circle at 26% 64%, rgba(196, 181, 253, 0.55) 0 0.8px, transparent 1.4px),
			radial-gradient(circle at 41% 18%, rgba(245, 244, 241, 0.4) 0 0.6px, transparent 1.2px),
			radial-gradient(circle at 58% 42%, rgba(196, 181, 253, 0.5) 0 0.7px, transparent 1.3px),
			radial-gradient(circle at 72% 15%, rgba(245, 244, 241, 0.55) 0 0.7px, transparent 1.3px),
			radial-gradient(circle at 84% 55%, rgba(196, 181, 253, 0.4) 0 0.6px, transparent 1.2px),
			radial-gradient(circle at 92% 30%, rgba(245, 244, 241, 0.5) 0 0.7px, transparent 1.3px),
			radial-gradient(circle at 6% 74%, rgba(196, 181, 253, 0.35) 0 0.6px, transparent 1.2px);
	}

	.pip-stage:focus-visible {
		box-shadow: inset 0 0 0 2px rgba(196, 181, 253, 0.6);
	}

	.pip-stage[data-pose='sleep'] {
		background:
			radial-gradient(
				85% 80% at 50% 102%,
				rgba(76, 29, 149, 0.24) 0%,
				rgba(76, 29, 149, 0.06) 50%,
				transparent 74%
			),
			linear-gradient(
				180deg,
				rgba(4, 6, 14, 0.42) 0%,
				rgba(7, 9, 18, 0.16) 58%,
				rgba(4, 6, 14, 0.46) 100%
			);
	}

	.pip-ground {
		position: absolute;
		left: 10%;
		right: 10%;
		bottom: 32px;
		height: 1px;
		z-index: 1;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(196, 181, 253, 0.14) 14%,
			rgba(221, 214, 254, 0.48) 50%,
			rgba(196, 181, 253, 0.14) 86%,
			transparent
		);
	}

	.pip-ground::after {
		content: '';
		position: absolute;
		left: -8%;
		right: -8%;
		top: -9px;
		height: 20px;
		background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.24), transparent 70%);
		filter: blur(3px);
	}

	.pip-mover {
		position: absolute;
		bottom: 29px;
		width: 96px;
		height: 96px;
		z-index: 2;
		will-change: transform;
		transition: filter 0.4s ease;
	}

	.pip-aura {
		position: absolute;
		left: 50%;
		top: 56%;
		width: 136px;
		height: 126px;
		transform: translate(-50%, -50%);
		pointer-events: none;
		background: radial-gradient(
			ellipse at center,
			rgba(139, 92, 246, 0.3) 0%,
			rgba(99, 102, 241, 0.11) 46%,
			transparent 72%
		);
		filter: blur(7px);
		opacity: 0.82;
		animation: pip-aura-breathe 6.4s ease-in-out infinite;
	}

	.pip-stage:hover .pip-aura {
		opacity: 1;
	}

	.pip-stage[data-pose='sleep'] .pip-aura {
		opacity: 0.38;
		animation: none;
	}

	.pip-stage[data-pose='walk'] .pip-aura {
		background: radial-gradient(
			ellipse at center,
			rgba(167, 139, 250, 0.34) 0%,
			rgba(99, 102, 241, 0.12) 46%,
			transparent 72%
		);
	}

	.pip-shadow {
		position: absolute;
		left: 50%;
		bottom: 0;
		width: 64px;
		height: 8px;
		transform: translateX(-50%);
		background: radial-gradient(
			ellipse at center,
			rgba(3, 4, 10, 0.8) 0%,
			rgba(3, 4, 10, 0.3) 56%,
			transparent 76%
		);
		filter: blur(1px);
	}

	.pip-stage[data-pose='sit'] .pip-shadow,
	.pip-stage[data-pose='sleep'] .pip-shadow {
		width: 74px;
		opacity: 0.92;
	}

	.pip-stage[data-pose='jump'] .pip-shadow {
		width: 52px;
		opacity: 0.55;
	}

	.pip-stage[data-pose='tipped'] .pip-shadow {
		width: 86px;
		opacity: 0.86;
	}

	/* The flip layer mirrors the sprite and the antenna together, exactly like
	   the plugin. The antenna rig stays in unmirrored cell coordinates. */
	.pip-figure {
		position: relative;
		width: 96px;
		height: 96px;
		transform-origin: 50% 100%;
	}

	.pip-sprite {
		position: relative;
		width: 96px;
		height: 96px;
		background-repeat: no-repeat;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}

	/* A fixed 32x32 backing store, stretched by CSS so its pixels line up with
	   the cell at every integer scale. Decorative: never a pointer target. */
	.pip-antenna {
		position: absolute;
		inset: 0;
		width: 96px;
		height: 96px;
		pointer-events: none;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}

	/* A separate transparent layer over the whole stage. Its backing store is
	   exactly its displayed CSS size, so the particle module's 1-3px squares
	   stay on the grid. Decorative: pointer-events is never negotiable here. */
	.pip-particles {
		position: absolute;
		inset: 0;
		z-index: 3;
		width: 100%;
		height: 100%;
		pointer-events: none;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
	}

	/* Speech bubble. Anchored above the head inside `.pip-mover`, so it travels
	   with him; the `left` offset (and the tail) are clamped in script against
	   the stage so the panel never leaves the card. The element is always
	   mounted and only its visibility changes: no layout shift, no stacking, and
	   a replacement line swaps text without the panel moving. */
	.pip-speech {
		position: absolute;
		bottom: calc(100% + 10px);
		z-index: 3;
		width: max-content;
		max-width: 224px; /* clamped inline by speechMaxWidth */
		padding: 5px 8px 6px;
		border: 1px solid rgba(196, 181, 253, 0.36);
		border-radius: 3px;
		background: rgba(9, 11, 20, 0.93);
		color: rgba(245, 244, 241, 0.94);
		font-size: 10.5px;
		font-weight: 400;
		line-height: 1.35;
		letter-spacing: 0.01em;
		text-align: center;
		text-wrap: balance;
		overflow-wrap: break-word;
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
		transform: translateX(-50%);
		box-shadow:
			0 12px 26px -18px rgba(0, 0, 0, 0.95),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.pip-speech[data-showing='true'] {
		opacity: 1;
		visibility: visible;
		animation: pip-speech-pop 150ms steps(2, end);
	}

	.pip-speech-text {
		display: block;
	}

	/* A little square turned 45°: a pointer that costs two borders, and reads
	   as pixel art at this size. */
	.pip-speech-tail {
		position: absolute;
		bottom: -4px;
		width: 6px;
		height: 6px;
		margin-left: -3px;
		background: rgba(9, 11, 20, 0.93);
		border-right: 1px solid rgba(196, 181, 253, 0.36);
		border-bottom: 1px solid rgba(196, 181, 253, 0.36);
		transform: rotate(45deg);
	}

	@keyframes pip-speech-pop {
		from {
			opacity: 0;
			translate: 0 4px;
		}
		to {
			opacity: 1;
			translate: 0 0;
		}
	}

	.pip-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 1rem 0.65rem;
		font-size: 0.6875rem;
		line-height: 1.2;
		color: rgba(245, 244, 241, 0.52);
	}

	.pip-caption {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
		min-height: 1em;
		letter-spacing: 0.01em;
		transition: color 0.25s ease;
	}

	.pip-caption::before {
		content: '';
		flex: 0 0 auto;
		width: 4px;
		height: 4px;
		background: rgba(196, 181, 253, 0.65);
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.55);
	}

	.pip-controls {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		flex: 0 0 auto;
	}

	.pip-mood {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 1.5rem;
		padding: 0 0.5rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.035);
		color: rgba(245, 244, 241, 0.55);
		font: inherit;
		font-size: 0.625rem;
		line-height: 1;
		letter-spacing: 0.08em;
		cursor: pointer;
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			background 0.2s ease;
	}

	.pip-mood:hover {
		color: rgba(245, 244, 241, 0.82);
		border-color: rgba(196, 181, 253, 0.32);
		background: rgba(139, 92, 246, 0.1);
	}

	.pip-mood:focus-visible {
		outline: 2px solid rgba(196, 181, 253, 0.7);
		outline-offset: 2px;
	}

	.pip-mood-dot {
		width: 4px;
		height: 4px;
		border-radius: 1px;
		background: #c4b5fd;
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.85);
	}

	.pip-mood[data-mood='off'] {
		color: rgba(245, 244, 241, 0.42);
	}

	.pip-mood[data-mood='off'] .pip-mood-dot {
		background: #64748b;
		box-shadow: none;
	}

	.pip-key {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex: 0 0 auto;
		font-size: 0.5625rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(245, 244, 241, 0.28);
	}

	.pip-key kbd {
		display: inline-block;
		padding: 1px 4px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-bottom-color: rgba(0, 0, 0, 0.45);
		border-radius: 3px;
		background: rgba(255, 255, 255, 0.05);
		color: rgba(245, 244, 241, 0.48);
		font-family: inherit;
		font-size: inherit;
		line-height: 1.35;
	}

	@keyframes pip-aura-breathe {
		0%,
		100% {
			opacity: 0.68;
			transform: translate(-50%, -50%) scale(1);
		}
		50% {
			opacity: 0.92;
			transform: translate(-50%, -50%) scale(1.05);
		}
	}

	@keyframes pip-dot-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 1;
		}
	}

	@media (max-width: 379px) {
		.pip-key {
			display: none;
		}

		.pip-stage {
			height: 184px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pip-aura,
		.pip-dot {
			animation: none !important;
		}

		/* Still show the words; just no pop. */
		.pip-speech[data-showing='true'] {
			animation: none !important;
		}

		.pip-mover,
		.pip-caption,
		.pip-mood {
			transition: none !important;
		}
	}
</style>
