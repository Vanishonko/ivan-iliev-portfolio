<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbJsonLd, gameJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	const GAME_URL = 'https://vanishonko.github.io/driftblock/';

	let started = $state(false);
	let frame: HTMLDivElement | undefined = $state();

	const launch = () => (started = true);

	const fullscreen = async () => {
		if (!frame) return;
		if (document.fullscreenElement) await document.exitFullscreen();
		else await frame.requestFullscreen?.();
	};
</script>

<Seo
	title="driftblock — play | ivan iliev"
	description="Play driftblock in the browser: a blocky 3D drift racer with no build step, four procedural circuits and an engine synthesised in Web Audio."
	path="/play/driftblock"
	image={socialImage('driftblock')}
	type="article"
	jsonLd={[
		gameJsonLd({
			name: 'driftblock',
			description: 'A blocky 3D drift racer that runs entirely in the browser: procedural circuits, synthesised engine, keyboard, gamepad and force feedback on a real wheel.',
			path: '/play/driftblock',
			slug: 'driftblock',
			tags: ['three.js', 'webgl', 'drift', 'racing', 'web audio'],
			released: '2026-09-30'
		}),
		breadcrumbJsonLd([
			{ name: 'ivan iliev', path: '/' },
			{ name: 'play', path: '/play' },
			{ name: 'driftblock', path: '/play/driftblock' }
		])
	]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableClouds />

	<section class="px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
		<div class="mx-auto w-full max-w-5xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/60">play</p>
				<h1 class="mt-2 text-3xl font-semibold text-muted-50 sm:text-4xl">driftblock</h1>
				<p class="mt-3 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					A blocky 3D drift racer that runs entirely in the browser. Four procedural circuits, a synthesised
					engine and no build step. Keyboard, gamepad and wheel all work — a real wheel even gets force feedback
					through a native bridge.
				</p>
				<p class="mt-4 text-sm">
					<a
						href="/projects/driftblock"
						class="text-muted-50/70 underline-offset-4 hover:text-white hover:underline"
						>how the drifting works →</a
					>
				</p>
			</AnimatedSection>

			<AnimatedSection delay={160} class="mt-6 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={launch}
					class="rounded-full bg-muted-50 px-5 py-2.5 text-sm font-medium text-[#0b0d16] transition hover:bg-white"
				>
					{started ? 'restart' : 'launch the game'}
				</button>
				{#if started}
					<button
						type="button"
						onclick={fullscreen}
						class="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
					>
						fullscreen
					</button>
					<a
						href={GAME_URL}
						target="_blank"
						rel="noreferrer"
						class="text-sm text-muted-50/64 underline-offset-4 hover:text-muted-50 hover:underline"
					>
						open standalone ↗
					</a>
				{/if}
			</AnimatedSection>
		</div>
	</section>

	<section class="px-4 pb-16 sm:px-6">
		<div class="mx-auto w-full max-w-5xl">
			<div
				bind:this={frame}
				class="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl shadow-black/40"
			>
				{#if started}
					<iframe
						src={GAME_URL}
						title="driftblock — a 3D drift racing game"
						class="h-full w-full border-0"
						allow="fullscreen; gamepad"
						loading="lazy"
					></iframe>
				{:else}
					<button
						type="button"
						onclick={launch}
						class="group absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
					>
						<span
							class="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-muted-50 transition group-hover:scale-105 group-hover:bg-white/15"
							aria-hidden="true"
						>
							<svg viewBox="0 0 24 24" class="ml-1 h-6 w-6" fill="currentColor">
								<path d="M8 5.5v13l11-6.5-11-6.5z" />
							</svg>
						</span>
						<span class="text-sm text-muted-50/78">launch driftblock</span>
						<span class="max-w-xs text-xs text-muted-50/58">
							loads about 28 MB of three.js, car meshes and audio — nothing is fetched until you click
						</span>
					</button>
				{/if}
			</div>

			<p class="mt-4 text-xs leading-relaxed text-muted-50/58">
				The car body is a modified “Citroen C5 Sedan And Estate” by Nieve5677, licensed
				<a class="underline underline-offset-2 hover:text-muted-50/70" href="http://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
				Everything else — circuits, engine, particles — is generated at runtime.
			</p>
		</div>
	</section>
</main>
