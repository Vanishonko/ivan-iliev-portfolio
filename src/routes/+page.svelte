<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { SITE, personJsonLd, websiteJsonLd } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';
	import { ANIMATION_DELAY, PAGE_TITLE, PAGE_SUBTITLE } from '$lib/constants';
	import { milestones } from '$lib/data/timeline';

	const titleWords = PAGE_TITLE.split(' ');
	const titleWordChars = titleWords.map((word) => word.split(''));

	const selected = [
		{
			href: '/projects/dewdrop-bend',
			title: 'Dewdrop Bend',
			year: '2026',
			stack: 'vanilla JS · Canvas 2D · no dependencies',
			line: 'A living pixel-art pond with a 24-hour sky, thirteen creatures and a clock you can drag.'
		},
		{
			href: '/projects/driftblock',
			title: 'driftblock',
			year: '2026',
			stack: 'three.js · Web Audio · no build step',
			line: 'A 3D drift racer where the circuits, the engine and the skid marks are all generated at runtime.'
		},
		{
			href: '/projects/ai-f1-racing',
			title: 'ai-f1-racing',
			year: '2026',
			stack: 'TypeScript · evolution strategies',
			line: 'A neural driver trained by evolution on a deterministic 2D sim, on circuits traced from Spa and Baku.'
		},
		{
			href: '/projects/beaverwize',
			title: 'BeaverWize',
			year: '2025',
			stack: 'SvelteKit · Express · microservices',
			line: 'A gamified water-conservation app: measurements, streaks, rewards with real brands.'
		},
		{
			href: '/projects/laravel-nda',
			title: 'Laravel application',
			year: '2025',
			stack: 'Laravel · MySQL · Docker',
			line: 'Replaced spreadsheet-and-paper workflows for an international steel producer. Under NDA.'
		}
	];

	const kindColour: Record<string, string> = {
		start: 'bg-violet-400/15 text-violet-200/90',
		school: 'bg-white/10 text-muted-50/78',
		team: 'bg-sky-400/10 text-sky-200/80',
		teach: 'bg-emerald-400/10 text-emerald-200/80',
		work: 'bg-amber-400/10 text-amber-200/80',
		solo: 'bg-violet-400/15 text-violet-200/90'
	};
</script>

<Seo
	 title="ivan iliev — browser games, pixel art and tooling"
	 description={SITE.description}
	 path="/"
	 jsonLd={[websiteJsonLd()]}
/>

<main>
	<InteractiveBackground enableStars enableClouds enableAurora />

	<!-- Hero -->
	<section class="relative flex min-h-[calc(100svh-3.5rem)] items-center px-4 py-16 sm:min-h-[calc(100svh-4rem)] sm:px-6">
		<div class="mx-auto w-full max-w-3xl">
			<AnimatedSection delay={ANIMATION_DELAY.TITLE}>
				<p class="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200/90">
					<span class="h-1.5 w-1.5 rounded-full bg-emerald-300"></span>
					Vlissingen, NL · open to work
				</p>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.TITLE}>
				<h1 class="title-typewriter text-[clamp(1.9rem,9vw,3.6rem)] font-bold leading-[1.02]">
				<span class="sr-only">ivan iliev</span>
					<span class="inline-flex flex-wrap gap-x-3 gap-y-2" aria-hidden="true">
						{#each titleWordChars as wordChars, wi (wi)}
							<span class="inline-flex">
								{#each wordChars as char, ci (`${wi}-${ci}`)}
									<span class="title-char">{char}</span>
								{/each}
							</span>
						{/each}
					</span>
				</h1>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.SUBTITLE} class="mt-5">
				<p class="max-w-xl text-base leading-relaxed text-muted-50/82 sm:text-lg">
					{PAGE_SUBTITLE}. I build things that run in a browser and do something you can watch — a pond that keeps
					time, a drift racer with no assets, a racing AI that trains itself, and a workshop of tools for an agent
					I use every day.
				</p>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.CTA} class="mt-8 flex flex-wrap items-center gap-3">
				<a
					href="/projects"
					class="rounded-full bg-muted-50 px-5 py-2.5 text-sm font-medium text-[#0b0d16] transition hover:bg-white"
				>
					see the work →
				</a>
				<a
					href="/lab"
					class="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
				>
					visit the lab
				</a>
				<a
					href="/IlievIvanCV.pdf"
					download="IlievIvanCV.pdf"
					class="px-1 py-2.5 text-sm text-muted-50/70 underline-offset-4 transition hover:text-muted-50 hover:underline"
				>
					download cv
				</a>
			</AnimatedSection>
		</div>
	</section>

	<!-- Selected work -->
	<section class="relative px-4 pb-20 sm:px-6" aria-labelledby="selected-heading">
		<div class="mx-auto w-full max-w-3xl">
			<div class="mb-4 flex items-baseline justify-between gap-4 border-b border-white/10 pb-3">
				<h2 id="selected-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/64">selected work</h2>
				<a href="/projects" class="text-xs text-muted-50/70 underline-offset-4 hover:text-muted-50 hover:underline">
					all projects →
				</a>
			</div>

			<ul class="divide-y divide-white/5">
				{#each selected as item, i (item.href)}
					<li>
						<AnimatedSection delay={120 + i * 70}>
							<a
								href={item.href}
								class="group grid grid-cols-1 gap-1 py-5 sm:grid-cols-[5rem_1fr_auto] sm:items-baseline sm:gap-6"
							>
								<span class="font-typewriter text-xs text-muted-50/60">{item.year}</span>
								<span>
									<span class="block text-lg text-muted-50 transition-colors group-hover:text-white">{item.title}</span>
									<span class="mt-0.5 block text-sm text-muted-50/64">{item.line}</span>
									<span class="mt-1 block text-xs text-muted-50/58">{item.stack}</span>
								</span>
								<span
									class="hidden text-muted-50/25 transition-all group-hover:translate-x-1 group-hover:text-muted-50/78 sm:block"
									aria-hidden="true">→</span
								>
							</a>
						</AnimatedSection>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- The lab -->
	<section class="relative px-4 pb-20 sm:px-6" aria-labelledby="lab-heading">
		<div class="mx-auto w-full max-w-3xl">
			<div class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md">
				<div class="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
					<div>
						<h2 id="lab-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/64">the lab</h2>
						<p class="mt-3 text-lg text-muted-50">Half of what I build is private.</p>
						<p class="mt-2 max-w-lg text-sm leading-relaxed text-muted-50/70">
							A pixel-art surface where a model draws, looks at its own drawing and draws again. A 32×32
							creature that lives in the corner of the window. A bell that tells you what a turn cost. The
							repositories stay closed — the work does not have to.
						</p>
						<a
							href="/lab"
							class="mt-5 inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-4 py-2 text-sm text-violet-100 transition hover:border-violet-300/40 hover:bg-violet-400/15"
						>
							step inside →
						</a>
					</div>

					<img
						src="/images/pip.gif"
						alt="Pip, a small pixel creature"
						width="128"
						height="128"
						class="mx-auto h-24 w-24 [image-rendering:pixelated] sm:h-32 sm:w-32"
						loading="lazy"
					/>
				</div>
			</div>
		</div>
	</section>

	<!-- Timeline -->
	<section class="relative px-4 pb-20 sm:px-6" aria-labelledby="road-heading">
		<div class="mx-auto w-full max-w-3xl">
			<div class="mb-6 border-b border-white/10 pb-3">
				<h2 id="road-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/64">how it got here</h2>
			</div>

			<ol class="relative space-y-8 border-l border-white/10 pl-6">
				{#each milestones as m (m.year + m.title)}
					<li class="relative">
						<span class="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-muted-50/56 ring-4 ring-[#0a0e1a]"
						></span>
						<div class="flex flex-wrap items-center gap-3">
							<span class="font-typewriter text-sm text-muted-50/80">{m.year}</span>
							<span class="rounded-full px-2 py-0.5 text-[11px] {kindColour[m.kind]}">{m.kind}</span>
						</div>
						<h3 class="mt-1 text-base text-muted-50">{m.title}</h3>
						<p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted-50/66">{m.body}</p>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- Contact -->
	<section class="relative px-4 pb-24 sm:px-6" aria-labelledby="contact-heading">
		<div class="mx-auto w-full max-w-3xl">
			<div
				class="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-transparent to-amber-400/5 p-6 sm:p-8"
			>
				<h2 id="contact-heading" class="text-lg text-muted-50">Looking for someone who ships?</h2>
				<p class="mt-2 max-w-lg text-sm leading-relaxed text-muted-50/70">
					I'm in my final stretch at HZ and open to work — an internship, a junior role, or a project that needs a pair of
					hands. The CV is above; the rest is one click away.
				</p>
				<div class="mt-5 flex flex-wrap gap-3">
					<a
						href="mailto:vanishonko@gmail.com"
						class="rounded-full bg-muted-50 px-4 py-2 text-sm font-medium text-[#0b0d16] transition hover:bg-white"
					>
						vanishonko@gmail.com
					</a>
					<a
						href="https://www.linkedin.com/in/ivan-iliev-931511221/"
						class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
						rel="me"
					>
						linkedin
					</a>
					<a
						href="https://github.com/Vanishonko"
						class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
						rel="me"
					>
						github
					</a>
				</div>
			</div>
		</div>
	</section>
</main>
