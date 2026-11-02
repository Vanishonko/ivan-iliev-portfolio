<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	/* ------------------------------------------------------------------ */
	/* Sprite data: 32×32 frames laid out horizontally, at 3× (96px).      */
	/* Timings are the plugin’s per-frame millisecond values.              */
	/* ------------------------------------------------------------------ */

	const ART = 32;
	const SCALE = 3;
	const SIZE = ART * SCALE;
	const EDGE = 14;

	const WALK_SPEED = 58; // CSS px per second
	const LOOK_FRAME_MS = 360;
	const LOOK_NOTICE_MS = 420;
	const IDLE_TO_SIT_MS = 6500;
	const SIT_TO_SLEEP_MS = 7500;

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
		| 'aha';

	type Reaction = Extract<Pose, 'happy' | 'giggle' | 'jump' | 'startle' | 'aha'>;

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
		}
	};

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
		aha: 'aha!'
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
	let announcement = $state('');

	const currentSheet = $derived(SHEETS[pose]);
	const caption = $derived(CAPTIONS[pose]);
	const spriteStyle = $derived(
		[
			`background-image:url(${currentSheet.url})`,
			`background-size:${currentSheet.frames * SIZE}px ${SIZE}px`,
			`background-position:-${frame * SIZE}px 0`,
			`transform:scaleX(${facing})`
		].join(';')
	);

	/* ------------------------------------------------------------------ */
	/* Internal, non-reactive state                                        */
	/* ------------------------------------------------------------------ */

	let rootEl = $state<HTMLElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);
	let spriteEl = $state<HTMLDivElement | null>(null);

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

	let lastReaction: Reaction | null = null;
	let staticReactionTimer: ReturnType<typeof setTimeout> | null = null;

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

	function triggerReaction(): void {
		const now = performance.now();
		lastActivity = now;

		const options = REACTIONS.filter((reaction) => reaction !== lastReaction);
		const reaction = options[Math.floor(Math.random() * options.length)] ?? 'happy';
		lastReaction = reaction;
		announce(ANNOUNCEMENTS[reaction]);

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
				startSit(now);
			}
			return;
		}

		if (pose === 'sit') {
			if (!pointerInside && now - sitStartedAt >= SIT_TO_SLEEP_MS) {
				startSleep();
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
		if (pose === 'walk') updateWalk(dt);
		updateMood(now);
	}

	function tick(timestamp: number): void {
		rafId = null;
		if (!lastTimestamp) lastTimestamp = timestamp;
		const dt = Math.min(120, Math.max(0, timestamp - lastTimestamp));
		lastTimestamp = timestamp;

		if (x !== null) update(dt, timestamp);

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
	/* Interaction                                                         */
	/* ------------------------------------------------------------------ */

	function pointToSprite(clientX: number): number {
		const rect = stageEl?.getBoundingClientRect();
		if (!rect) return x ?? EDGE;
		return clamp(clientX - rect.left - SIZE / 2, EDGE, maxLeft());
	}

	function handlePointer(event: PointerEvent): void {
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
			setPose('idle', 0);
			stopLoop();
		} else {
			syncLoop();
		}
	}

	/* ------------------------------------------------------------------ */
	/* Lifecycle                                                           */
	/* ------------------------------------------------------------------ */

	onMount(() => {
		const root = rootEl;
		const stage = stageEl;
		if (!root || !stage) return;

		for (const sheet of Object.values(SHEETS)) {
			const image = new Image();
			image.src = sheet.url;
		}

		lastActivity = performance.now();

		const measure = (): void => {
			stageWidth = stage.clientWidth;
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
			<div class="pip-sprite" bind:this={spriteEl} style={spriteStyle} aria-hidden="true"></div>
		</div>
	</div>

	<footer class="pip-foot">
		<p class="pip-caption" aria-hidden="true">{caption}</p>
		<span class="pip-key" aria-hidden="true"><kbd>space</kbd> / <kbd>enter</kbd></span>
	</footer>

	<p class="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
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
			radial-gradient(90% 85% at 50% 102%, rgba(124, 58, 237, 0.2) 0%, rgba(124, 58, 237, 0.05) 48%, transparent 74%),
			linear-gradient(180deg, rgba(7, 9, 18, 0.28) 0%, rgba(7, 9, 18, 0.08) 58%, rgba(7, 9, 18, 0.34) 100%);
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
			radial-gradient(85% 80% at 50% 102%, rgba(76, 29, 149, 0.24) 0%, rgba(76, 29, 149, 0.06) 50%, transparent 74%),
			linear-gradient(180deg, rgba(4, 6, 14, 0.42) 0%, rgba(7, 9, 18, 0.16) 58%, rgba(4, 6, 14, 0.46) 100%);
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
		background: radial-gradient(ellipse at center, rgba(3, 4, 10, 0.8) 0%, rgba(3, 4, 10, 0.3) 56%, transparent 76%);
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

	.pip-sprite {
		position: relative;
		width: 96px;
		height: 96px;
		background-repeat: no-repeat;
		image-rendering: crisp-edges;
		image-rendering: pixelated;
		transform-origin: 50% 50%;
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

		.pip-mover,
		.pip-caption {
			transition: none !important;
		}
	}
</style>
