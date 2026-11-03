<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbJsonLd, gameJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	const SRC = '/games/dewdrop-bend/index.html';

	let started = $state(false);
	let frame: HTMLDivElement | undefined = $state();

	const launch = () => (started = true);

	const fullscreen = async () => {
		if (!frame) return;
		if (document.fullscreenElement) await document.exitFullscreen();
		else await frame.requestFullscreen?.();
	};

	const features = [
		{ title: 'A real clock', body: 'Drag the hands through dawn, golden hour, dusk and a firefly-lit night. The sun and moon rise behind the ridge, with a real moon phase.' },
		{ title: 'Thirteen creatures', body: 'Bees, bumblebees, dragonflies, frogs, tadpoles, striders, fireflies — each with its own sprite, behaviour and a field note to collect.' },
		{ title: 'Plant the banks', body: 'Click a terrace to grow poppies, cornflowers or marsh marigolds. Depth-scaled, and the bees find them.' },
		{ title: 'Weather', body: 'One cloud button, and the rain samples the real uneven shoreline so the drops land where the water actually is.' }
	];
</script>

<Seo
	title="dewdrop bend — play | ivan iliev"
	description="Play Dewdrop Bend in the browser: a pixel-art pond with a 24-hour sky, thirteen creatures and a clock you can drag. Nothing to install."
	path="/play/dewdrop-bend"
	image={socialImage('dewdrop-bend')}
	type="article"
	jsonLd={[
		gameJsonLd({
			name: 'Dewdrop Bend',
			description: 'A living pixel-art pond with a 24-hour sky: drag the clock hands, plant the banks, and meet thirteen hand-drawn creatures, each with a field note.',
			path: '/play/dewdrop-bend',
			slug: 'dewdrop-bend',
			tags: ['pixel art', 'canvas 2d', 'simulation', 'procedural audio'],
			released: '2026-09-20'
		}),
		breadcrumbJsonLd([
			{ name: 'ivan iliev', path: '/' },
			{ name: 'play', path: '/play' },
			{ name: 'Dewdrop Bend', path: '/play/dewdrop-bend' }
		])
	]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableClouds />

	<section class="px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
		<div class="mx-auto w-full max-w-5xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/64">play</p>
				<h1 class="mt-2 text-3xl font-semibold text-muted-50 sm:text-4xl">Dewdrop Bend</h1>
				<p class="mt-3 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					A small, living pixel-art pond with a full 24-hour sky. Turn the clock hands, plant wildflowers on the
					banks, watch the bees work and the frogs hop between lily pads, let the rain in from a single cloud
					button, and collect a field note for every creature you meet.
				</p>
				<p class="mt-4 text-sm">
					<a
						href="/projects/dewdrop-bend"
						class="text-muted-50/70 underline-offset-4 hover:text-white hover:underline"
						>how it is built →</a
					>
				</p>
			</AnimatedSection>

			<AnimatedSection delay={160} class="mt-6 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={launch}
					class="rounded-full bg-muted-50 px-5 py-2.5 text-sm font-medium text-[#0b0d16] transition hover:bg-white"
				>
					{started ? 'restart the pond' : 'wake the pond'}
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
						href={SRC}
						target="_blank"
						rel="noreferrer"
						class="text-sm text-muted-50/70 underline-offset-4 hover:text-muted-50 hover:underline"
					>
						open standalone ↗
					</a>
				{/if}
			</AnimatedSection>
		</div>
	</section>

	<section class="px-4 pb-12 sm:px-6">
		<div class="mx-auto w-full max-w-5xl">
			<div
				bind:this={frame}
				class="relative aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-[#071513] shadow-2xl shadow-black/40"
			>
				{#if started}
					<iframe
						src={SRC}
						title="Dewdrop Bend — an interactive pixel-art pond"
						class="h-full w-full border-0"
						allow="fullscreen"
					></iframe>
				{:else}
					<button
						type="button"
						onclick={launch}
						class="group absolute inset-0 flex items-center justify-center"
					>
						<img
							src="/images/dewdrop-day.png"
							alt="Dewdrop Bend at two in the afternoon: a pond between flowering banks, bees at the hive, frogs on the lily pads"
							class="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.01] group-hover:opacity-100"
							width="1440"
							height="900"
						/>
						<span class="relative flex flex-col items-center gap-3 rounded-full px-6 py-4">
							<span
								class="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/50 text-muted-50 backdrop-blur transition group-hover:scale-105 group-hover:bg-black/60"
								aria-hidden="true"
							>
								<svg viewBox="0 0 24 24" class="ml-1 h-6 w-6" fill="currentColor">
									<path d="M8 5.5v13l11-6.5-11-6.5z" />
								</svg>
							</span>
							<span class="rounded-full bg-black/55 px-3 py-1 text-xs text-muted-50/90">wake the pond</span>
						</span>
					</button>
				{/if}
			</div>

			<p class="mt-4 text-xs leading-relaxed text-muted-50/58">
				Vanilla JavaScript and Canvas 2D — no frameworks, no runtime dependencies, no external image or sound
				files. Every sprite is hand-drawn at 1× and the soundscape is synthesised. The repository is private; this
				is a demo build.
			</p>
		</div>
	</section>

	<section class="px-4 pb-16 sm:px-6">
		<div class="mx-auto w-full max-w-5xl">
			<h2 class="text-xs uppercase tracking-[0.2em] text-muted-50/64">what's in the pond</h2>
			<div class="mt-5 grid gap-4 sm:grid-cols-2">
				{#each features as f, i (f.title)}
					<AnimatedSection delay={80 + i * 60}>
						<div class="h-full rounded-xl border border-white/10 bg-white/[0.03] p-4">
							<h3 class="text-sm text-muted-50">{f.title}</h3>
							<p class="mt-1.5 text-xs leading-relaxed text-muted-50/62">{f.body}</p>
						</div>
					</AnimatedSection>
				{/each}
			</div>

			<div class="mt-6 grid gap-3 sm:grid-cols-3">
				<figure class="overflow-hidden rounded-xl border border-white/10">
					<img src="/images/dewdrop-day.png" alt="Dewdrop Bend in daylight" class="w-full" width="1440" height="900" loading="lazy" />
					<figcaption class="bg-white/[0.03] px-3 py-2 text-xs text-muted-50/58">14:30 — the pond at work</figcaption>
				</figure>
				<figure class="overflow-hidden rounded-xl border border-white/10">
					<img src="/images/dewdrop-dusk.png" alt="Dewdrop Bend at dusk" class="w-full" width="1440" height="900" loading="lazy" />
					<figcaption class="bg-white/[0.03] px-3 py-2 text-xs text-muted-50/58">19:00 — golden hour</figcaption>
				</figure>
				<figure class="overflow-hidden rounded-xl border border-white/10">
					<img src="/images/dewdrop-night.png" alt="Dewdrop Bend at night with fireflies" class="w-full" width="1440" height="900" loading="lazy" />
					<figcaption class="bg-white/[0.03] px-3 py-2 text-xs text-muted-50/58">23:00 — fireflies</figcaption>
				</figure>
			</div>
		</div>
	</section>
</main>
