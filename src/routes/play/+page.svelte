<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { itemListJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	const games = [
		{
			href: '/play/dewdrop-bend',
			title: 'Dewdrop Bend',
			year: '2026',
			poster: '/images/dewdrop-day.png',
			alt: 'A pixel-art pond between flowering banks with bees and frogs',
			line: 'A living pixel-art pond with a 24-hour sky, thirteen creatures and a clock you can drag.',
			stack: 'vanilla JS · Canvas 2D · no dependencies'
		},
		{
			href: '/play/driftblock',
			title: 'driftblock',
			year: '2026',
			poster: '/images/driftblock-gameplay.webp',
			alt: 'A blocky car drifting through a purple-lit street circuit',
			line: 'A blocky 3D drift racer: procedural circuits, a synthesised engine, force feedback on a real wheel.',
			stack: 'three.js · Web Audio · no build step'
		},
		{
			href: '/play/dragons',
			title: 'Dragons',
			year: '2015',
			poster: '/images/dragons.webp',
			alt: 'Two green dragons and a brown enemy dragon over a photographic sky, painted by an eleven-year-old',
			line: 'The first game I still have. Built at eleven, unedited, with a warning label.',
			stack: 'JavaScript · one canvas · no idea what delta time was'
		}
	];
</script>

<Seo
	 title="play | ivan iliev"
	 description="Three things to play: Dewdrop Bend, a living pixel-art pond; driftblock, a blocky 3D drift racer; and Dragons, the 2015 game that started it all."
	 path="/play"
	 image={socialImage('play')}
	jsonLd={[
		itemListJsonLd('play', '/play', [
			{ name: 'Dewdrop Bend', path: '/play/dewdrop-bend', description: 'a living pixel-art pond with a 24-hour sky' },
			{ name: 'driftblock', path: '/play/driftblock', description: 'a blocky 3D drift racer with procedural circuits' },
			{ name: 'Dragons', path: '/play/dragons', description: 'the 2015 JavaScript game, archived unedited' }
		])]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableClouds enableAurora />

	<section class="px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
		<div class="mx-auto w-full max-w-5xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/64">play</p>
				<h1 class="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-muted-50 sm:text-4xl">
					Two small worlds and one relic.
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					No installs, no accounts. One is a pond that keeps time, one is a car that refuses to go straight, and
					one is a dragon game from 2015 that I am keeping on purpose.
				</p>
			</AnimatedSection>
		</div>
	</section>

	<section class="px-4 pb-20 sm:px-6">
		<div class="mx-auto grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each games as game, i (game.href)}
				<AnimatedSection delay={140 + i * 80}>
					<a
						href={game.href}
						class="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20"
					>
						<div class="relative aspect-[16/10] overflow-hidden">
							<img
								src={game.poster}
								alt={game.alt}
								class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
								width="1440"
								height="900"
								loading="lazy"
							/>
							<div class="absolute inset-0 bg-gradient-to-t from-[#070912] via-[#070912]/20 to-transparent"></div>
						</div>
						<div class="p-5">
							<div class="flex items-baseline justify-between gap-3">
								<h2 class="text-xl text-muted-50">{game.title}</h2>
								<span class="font-typewriter text-xs text-muted-50/64">{game.year}</span>
							</div>
							<p class="mt-2 text-sm leading-relaxed text-muted-50/62">{game.line}</p>
							<div class="mt-auto flex items-center justify-between pt-4">
								<span class="text-xs text-muted-50/62">{game.stack}</span>
								<span class="text-sm text-muted-50/70 transition group-hover:text-white">play →</span>
							</div>
						</div>
					</a>
				</AnimatedSection>
			{/each}
		</div>
	</section>
</main>
