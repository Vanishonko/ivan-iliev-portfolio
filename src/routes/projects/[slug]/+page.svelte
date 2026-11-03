<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { breadcrumbJsonLd, projectJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground, Gallery } from '$lib/components';
	import type { Project } from '$lib/types';

	let { data }: { data: { project: Project } } = $props();

	const project = $derived(data.project);
	const isVideo = (path: string) => path.endsWith('.webm');
	const wide = $derived(project.galleryAspect === 'wide');

	let galleryOpen = $state(false);
	let galleryImages: string[] = $state([]);
	let galleryLabel = $state('Project gallery');

	const openGallery = (images: string[], label = 'Project gallery') => {
		galleryImages = images;
		galleryLabel = label;
		galleryOpen = true;
	};
</script>

<Seo
	title={`${project.title.toLowerCase()} | ivan iliev`}
	description={project.metaDescription}
	path={`/projects/${project.id}`}
	image={socialImage(project.id)}
	type="article"
	jsonLd={[
		projectJsonLd(project),
		breadcrumbJsonLd([
			{ name: 'ivan iliev', path: '/' },
			{ name: 'work', path: '/projects' },
			{ name: project.title, path: `/projects/${project.id}` }
		])
	]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableClouds />

	<article class="px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
		<div class="mx-auto w-full max-w-3xl">
			<AnimatedSection delay={60}>
				<a href="/projects" class="text-xs text-muted-50/55 underline-offset-4 hover:text-muted-50 hover:underline">
					← all work
				</a>
			</AnimatedSection>

			<AnimatedSection delay={100}>
				<h1 class="mt-4 text-3xl font-semibold text-muted-50 sm:text-4xl">{project.title}</h1>
				<p class="mt-1 text-sm text-muted-50/64">{project.subtitle}</p>

				<p class="mt-3 font-typewriter text-xs uppercase tracking-[0.18em] text-muted-50/55">
					{project.year} · {project.role === 'solo' ? 'solo' : 'team'}
				</p>

				<div class="mt-4 flex flex-wrap gap-2">
					{#each project.tags as tag (tag)}
						<span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-50/70">{tag}</span>
					{/each}
				</div>
			</AnimatedSection>

			<AnimatedSection delay={140} class="mt-8 space-y-4">
				{#each project.description as paragraph, i (`${project.id}-p-${i}`)}
					<p class="text-sm leading-relaxed text-muted-50/78 sm:text-base">{paragraph}</p>
				{/each}
			</AnimatedSection>

			{#if project.galleryImages?.length}
				<AnimatedSection delay={180} class="mt-10">
					{#if wide}
						<button
							type="button"
							onclick={() => openGallery(project.galleryImages ?? [], project.galleryLabel)}
							class="group relative block aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40"
							aria-label={`Open the ${project.title} screenshots`}
						>
							<img
								src={project.galleryImages[0]}
								alt={`${project.title} screenshot`}
								class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01]"
								width="1440"
								height="900"
							/>
						</button>
					{:else}
						<div class="grid grid-cols-3 gap-3">
							{#each project.galleryImages as image, idx (image)}
								<button
									type="button"
									onclick={() => openGallery(project.galleryImages ?? [], project.galleryLabel)}
									class="group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-white/5"
								>
									{#if isVideo(image)}
										<video
											src={image}
											class="h-full w-full object-cover"
											muted
											playsinline
											autoplay
											loop
											aria-label={`${project.title} clip ${idx + 1}`}
										></video>
									{:else}
										<img
											src={image}
											alt={`${project.title} screenshot ${idx + 1}`}
											class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
										/>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</AnimatedSection>
			{/if}

			{#if project.note}
				<AnimatedSection delay={200} class="mt-8">
					<p class="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-muted-50/64">
						{project.note}
					</p>
				</AnimatedSection>
			{/if}

			{#if project.links?.length}
				<AnimatedSection delay={220} class="mt-8 flex flex-wrap gap-3">
					{#each project.links as link (link.href)}
						<a
							href={link.href}
							target={link.external ? '_blank' : undefined}
							rel={link.external ? 'noreferrer' : undefined}
							class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-violet-300/30 hover:bg-white/10"
						>
							{link.label} →
						</a>
					{/each}
				</AnimatedSection>
			{/if}
		</div>
	</article>
</main>

<Gallery images={galleryImages} label={galleryLabel} open={galleryOpen} onclose={() => (galleryOpen = false)} />
