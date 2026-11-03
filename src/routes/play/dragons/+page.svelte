<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbJsonLd, gameJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	const SRC = '/games/dragons/start.html';

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
	title="dragons (2015) — play | ivan iliev"
	description="The first game I still have: a 2015 JavaScript dragon game, built when I was eleven. Archived here unedited, with a warning label and no apologies."
	path="/play/dragons"
	image={socialImage('dragons')}
	type="article"
	jsonLd={[
		gameJsonLd({
			name: 'Dragons',
			description: 'A 2015 JavaScript arcade game by an eleven-year-old: one canvas, GIF dragons, a score counter and no delta time. Archived unedited.',
			path: '/play/dragons',
			slug: 'dragons',
			tags: ['javascript', 'canvas 2d', 'arcade', 'archive'],
			released: '2015-09-06'
		}),
		breadcrumbJsonLd([
			{ name: 'ivan iliev', path: '/' },
			{ name: 'play', path: '/play' },
			{ name: 'dragons', path: '/play/dragons' }
		])
	]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableClouds />

	<section class="px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
		<div class="mx-auto w-full max-w-4xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/64">play · archive · 2015</p>
				<h1 class="mt-2 text-3xl font-semibold text-muted-50 sm:text-4xl">Dragons</h1>
				<p class="mt-3 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					The oldest thing I still have. Built in 2015 — I was eleven — during my second year of JavaScript
					game-development classes at Telerik Kids Academy. It has been sitting in a public repository for a decade
					and I have finally found a use for it: proof of where this all started.
				</p>
			</AnimatedSection>

			<AnimatedSection delay={140} class="mt-6">
				<div class="rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] p-5 sm:p-6">
					<p class="font-typewriter text-xs uppercase tracking-[0.22em] text-amber-200/90">
						read this before you press play
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/85">
						<strong class="text-amber-100">I was eleven.</strong> There is no delta time, so the game runs at whatever
						your monitor does. Collisions are rectangles. The engine is one 4 KB file of global variables. The
						"art direction" is two sets of GIFs I found online and a sky photograph I stole from the internet
						without a second thought. The score is drawn in a free "Tribal Dragon" font I downloaded around the
						same time. The sounds are MP3s named after the noises they make. It is bad in ways I could not have
						avoided at eleven and would not fix now — fixing it would defeat the point.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/70">
						What it does have: dragons, a score counter in a tribal font, and the exact moment I decided this was
						what I wanted to do with my life.
					</p>
				</div>
			</AnimatedSection>

			<AnimatedSection delay={180} class="mt-6 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onclick={launch}
					class="rounded-full bg-muted-50 px-5 py-2.5 text-sm font-medium text-[#0b0d16] transition hover:bg-white"
				>
					{started ? 'restart the dragons' : 'wake the dragons'}
				</button>
				{#if started}
					<button
						type="button"
						onclick={fullscreen}
						class="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
					>
						fullscreen
					</button>
				{/if}
				<span class="text-xs text-muted-50/55">mouse to fly · space to restart</span>
			</AnimatedSection>
		</div>
	</section>

	<section class="px-4 pb-12 sm:px-6">
		<div class="mx-auto w-full max-w-4xl">
			<div
				bind:this={frame}
				class="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40"
			>
				{#if started}
					<iframe
						src={SRC}
						title="Dragons — a 2015 JavaScript game"
						class="h-full w-full border-0"
						allow="fullscreen; autoplay"
					></iframe>
				{:else}
					<button type="button" onclick={launch} class="group absolute inset-0 flex items-center justify-center">
						<img
							src="/images/dragons.webp"
							alt="The 2015 game: two green dragons and a brown enemy dragon over a photographic sky, with a red 'Score:0' in the corner"
							class="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-500 group-hover:opacity-100"
							width="800"
							height="600"
						/>
						<span class="relative flex flex-col items-center gap-3">
							<span
								class="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/45 text-muted-50 backdrop-blur transition group-hover:scale-105 group-hover:bg-black/60"
								aria-hidden="true"
							>
								<svg viewBox="0 0 24 24" class="ml-1 h-6 w-6" fill="currentColor">
									<path d="M8 5.5v13l11-6.5-11-6.5z" />
								</svg>
							</span>
							<span class="rounded-full bg-black/55 px-3 py-1 text-xs text-muted-50/90">wake the dragons</span>
						</span>
					</button>
				{/if}
			</div>

			<p class="mt-4 text-xs leading-relaxed text-muted-50/55">
				Runs in an iframe because it was written for one 800×600 canvas and does not deserve to be ported. It is
				the original file, unedited — <a
					class="underline underline-offset-2 hover:text-muted-50"
					href="https://github.com/Vanishonko/Dragons">source on GitHub</a
				>.
			</p>
		</div>
	</section>

	<section class="px-4 pb-20 sm:px-6">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
					<p class="font-typewriter text-xs uppercase tracking-[0.18em] text-muted-50/55">before</p>
					<p class="mt-2 text-sm text-muted-50/78">C++ and competitive problems</p>
					<p class="mt-1 text-xs leading-relaxed text-muted-50/55">Telerik Kids Academy, age eight.</p>
				</div>
				<div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
					<p class="font-typewriter text-xs uppercase tracking-[0.18em] text-muted-50/55">this</p>
					<p class="mt-2 text-sm text-muted-50/78">Dragons</p>
					<p class="mt-1 text-xs leading-relaxed text-muted-50/55">JavaScript, age eleven — the oldest thing I kept.</p>
				</div>
				<div class="rounded-xl border border-white/10 bg-white/[0.03] p-4">
					<p class="font-typewriter text-xs uppercase tracking-[0.18em] text-muted-50/55">after</p>
					<p class="mt-2 text-sm text-muted-50/78">Dewdrop Bend, driftblock, ai-f1</p>
					<p class="mt-1 text-xs leading-relaxed text-muted-50/55">Same kid, better tooling.</p>
				</div>
			</div>

			<div class="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
				<p class="font-typewriter text-xs uppercase tracking-[0.18em] text-muted-50/55">the rest of the shelf</p>
				<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-50/70">
					Dragons used to live on <a
						class="underline underline-offset-4 hover:text-white"
						href="http://feckliga.free.bg">feckliga.free.bg</a
					> — a page I have been dumping things on since 2016. The version you can still open is that same list of
					links wrapped in CSS I asked ChatGPT for a few years ago; the 2016 original was nine bare
					<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">&lt;a&gt;</code> tags, two of which have
					since been retired. It still links what still runs — a Voronoi sketch, a work-in-progress RPG, a Game of
					Life and an old school site — plus two canvas experiments with the best names in the archive:
					<em>Chep.io Prototype</em> and <em>Click me!</em>.
				</p>
			</div>
		</div>
	</section>
</main>
