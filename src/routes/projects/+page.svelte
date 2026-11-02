<script lang="ts">
	import { AnimatedSection, InteractiveBackground } from '$lib/components';
	import { projects } from '$lib/data/projects';

	const isVideo = (path: string) => path.endsWith('.webm');
	const posterOf = (p: (typeof projects)[number]) =>
		p.poster ?? p.galleryImages?.find((i) => !isVideo(i)) ?? null;
</script>

<svelte:head>
	<title>Work | Ivan Iliev</title>
	<meta
		name="description"
		content="Six projects: a pixel-art pond, a drift racing game, an evolutionary racing AI, a gamified water-conservation app, an NDA Laravel application and a private plugin workshop."
	/>
	<meta property="og:title" content="Work | Ivan Iliev" />
	<meta
		property="og:description"
		content="A pixel-art pond, a drift racer, an evolutionary racing AI, and the tooling around them."
	/>
</svelte:head>

<main class="relative">
	<InteractiveBackground enableStars enableClouds enableAurora />

	<header class="px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
		<div class="mx-auto w-full max-w-5xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/64">work</p>
				<h1 class="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-muted-50 sm:text-4xl">
					Six things I built, roughly in order of how much they hurt.
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					Two games, an AI, an app that tried to save water, one application I cannot show you, and a workshop of
					tools for a coding agent. Each card opens the long version.
				</p>
			</AnimatedSection>
		</div>
	</header>

	<section class="px-4 pb-20 sm:px-6" aria-label="Project list">
		<div class="mx-auto grid w-full max-w-5xl gap-5 sm:gap-6 md:grid-cols-2">
			{#each projects as project, i (project.id)}
				{@const poster = posterOf(project)}
				<AnimatedSection delay={120 + i * 60}>
					<a
						href={`/projects/${project.id}`}
						class="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20"
					>
						<div class="relative aspect-[16/10] overflow-hidden bg-[#0b0e18]">
							{#if poster}
								<img
									src={poster}
									alt=""
									class="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
									width="1440"
									height="900"
									loading="lazy"
								/>
								<div class="absolute inset-0 bg-gradient-to-t from-[#070912]/85 via-[#070912]/15 to-transparent"></div>
								<div class="absolute inset-0 bg-[#070912]/20 transition-opacity duration-500 group-hover:opacity-0"></div>
							{:else}
								<div
									class="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_30%_20%,rgba(167,139,250,0.18),transparent_62%)]"
								>
									<div
										class="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:14px_14px]"
									></div>
									<span class="relative font-typewriter text-sm uppercase tracking-[0.32em] text-muted-50/55">
										{project.tags[0]}
									</span>
								</div>
							{/if}
						</div>

						<div class="flex flex-1 flex-col p-5">
							<h2 class="text-lg text-muted-50 transition-colors group-hover:text-white">{project.title}</h2>
							<p class="mt-0.5 text-xs text-muted-50/55">{project.subtitle}</p>
							<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-50/62">
								{project.description[0]}
							</p>

							<div class="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
								{#each project.tags.slice(0, 3) as tag (tag)}
									<span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-muted-50/62">
										{tag}
									</span>
								{/each}
								<span class="ml-auto text-xs text-muted-50/55 transition group-hover:text-white">read →</span>
							</div>
						</div>
					</a>
				</AnimatedSection>
			{/each}
		</div>
	</section>
</main>
