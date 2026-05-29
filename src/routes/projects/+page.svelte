<script lang="ts">
	import { AnimatedSection, InteractiveBackground, Gallery } from '$lib/components';
	import { projects } from '$lib/data/projects';
	import type { ProjectLink } from '$lib/types';

	let galleryOpen = $state(false);
	let galleryImages: string[] = $state([]);
	let galleryLabel = $state('Project gallery');

	const openInNewTab = (link: ProjectLink) => link.external ?? link.href.startsWith('http');

	const openGallery = (images: string[], label = 'Project gallery') => {
		galleryImages = images;
		galleryLabel = label;
		galleryOpen = true;
	};

	const closeGallery = () => {
		galleryOpen = false;
	};
</script>

<svelte:head>
	<title>Projects | Ivan Iliev</title>
	<meta name="description" content="A showcase of my recent projects including BeaverWize, Laravel web applications, and this portfolio." />
	<meta property="og:title" content="Projects | Ivan Iliev" />
	<meta property="og:description" content="A showcase of my recent projects including BeaverWize, Laravel web applications, and this portfolio." />
</svelte:head>

<div class="relative min-h-[100svh] overflow-x-hidden">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>
	<InteractiveBackground enableStars enableClouds enableAurora />

	<main class="relative z-10 px-4 py-12 sm:px-6 sm:py-16">
		<div class="mx-auto w-full max-w-3xl space-y-10 fade-in sm:space-y-12">
			<header class="space-y-3 text-center">
				<AnimatedSection delay={80}>
					<h1 class="title-typewriter text-center text-[clamp(1.65rem,8.5vw,3rem)] font-bold leading-[1.05]">
						<span class="inline-flex">
							<span class="title-char">p</span>
							<span class="title-char">r</span>
							<span class="title-char">o</span>
							<span class="title-char">j</span>
							<span class="title-char">e</span>
							<span class="title-char">c</span>
							<span class="title-char">t</span>
							<span class="title-char">s</span>
						</span>
					</h1>
				</AnimatedSection>

				<AnimatedSection delay={140}>
					<p class="text-sm text-muted-50/80 sm:text-base">a few of my recent tinkerings.</p>
				</AnimatedSection>
			</header>

			<section class="space-y-6 sm:space-y-8" aria-label="Project list">
				{#each projects as project, i (project.id)}
					<AnimatedSection delay={200 + i * 90}>
						<article class="rounded-2xl border border-white/10 bg-muted-900/20 p-6 shadow-sm backdrop-blur-md sm:p-8">
							<header class="flex flex-col gap-3 sm:gap-4">
								<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div class="space-y-1">
										<div class="flex items-center justify-center gap-2 sm:justify-start">
											<h2 class="text-xl font-semibold text-muted-50 sm:text-2xl">{project.title}</h2>
										</div>
										<p class="text-center text-sm text-muted-50/70 sm:text-left">{project.subtitle}</p>
									</div>

									<div class="flex flex-wrap justify-center gap-2 sm:justify-end">
										{#each project.tags as tag (tag)}
											<span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-50/75">
												{tag}
											</span>
										{/each}
									</div>
								</div>
							</header>

							<div class="mt-5 space-y-4 text-muted-50/85 leading-relaxed">
								{#each project.description as paragraph, pi (`${project.id}-p-${pi}`)}
									<p class="text-sm sm:text-base">{paragraph}</p>
								{/each}
							</div>

							{#if project.galleryImages?.length}
								<div class="mt-6 space-y-3">
									<p class="text-sm text-muted-50/70">Selected screenshots</p>
									<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
										{#each project.galleryImages as image, idx (image)}
											<button
												type="button"
												onclick={() => openGallery(project.galleryImages ?? [], project.galleryLabel)}
												class="group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-white/5 transition-all duration-300 hover:border-white/20 hover:bg-white/10"
												aria-label={`Open screenshot ${idx + 1} for ${project.title}`}
											>
												<img
													src={image}
													alt={`${project.title} screenshot ${idx + 1}`}
													class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
												/>
												<div class="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20"></div>
											</button>
										{/each}
									</div>
								</div>
							{/if}

							{#if project.note}
								<p class="mt-6 text-sm text-muted-50/70">{project.note}</p>
							{/if}

							{#if project.links?.length}
								<div class="mt-6 flex flex-wrap justify-center gap-4 sm:justify-start">
									{#each project.links as link (link.href)}
										<a
											href={link.href}
											target={openInNewTab(link) ? '_blank' : undefined}
											rel={openInNewTab(link) ? 'noreferrer' : undefined}
											class="projects-link link-text rounded text-muted-50 transition-colors duration-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2"
											aria-label={`${project.title}: ${link.label}`}
										>
											{link.label} →
										</a>
									{/each}
								</div>
							{/if}
						</article>
					</AnimatedSection>
				{/each}
			</section>

			<footer class="flex justify-center pt-2">
				<AnimatedSection delay={520}>
					<a
						href="/"
						class="projects-link link-text rounded text-muted-50 transition-colors duration-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2"
						aria-label="Back to home"
					>
						← back home
					</a>
				</AnimatedSection>
			</footer>
		</div>
	</main>
</div>

<Gallery
	images={galleryImages}
	label={galleryLabel}
	open={galleryOpen}
	onclose={closeGallery}
/>
