<script lang="ts">
	import { onDestroy } from 'svelte';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	type ProjectLink = {
		label: string;
		href: string;
		external?: boolean;
	};

	type Project = {
		id: string;
		title: string;
		subtitle: string;
		tags: string[];
		description: string[];
		links?: ProjectLink[];
		galleryImages?: string[];
		galleryLabel?: string;
		note?: string;
	};

	let isGalleryOpen = false;
	let galleryImages: string[] = [];
	let galleryLabel = 'Project gallery';
	let currentImageIndex = 0;

	const projects = [
		{
			id: 'beaverwize',
			title: 'BeaverWize',
			subtitle: 'SvelteKit • Microservices • Gamification',
			tags: ['SvelteKit', 'Express', 'Microservices', 'API Gateway', 'Data Viz'],
			description: [
				'BeaverWize was an application developed using SvelteKit with an Express.js–based microservices architecture. It was designed to encourage people to conserve water and reduce waste by using gamification to build better habits while keeping users informed about their personal impact.',
				'The concept also focused on cooperation with sustainable brands, allowing users to exchange in-game currency for real discounts and promotions. The application featured multiple water-measuring activities, statistics, and data visualizations, as well as an achievement system that rewarded users with items to equip on their in-game character. In addition, it included a community feature that allowed users to collectively track and contribute to water-saving goals. On the backend, the system was built around individual microservices that communicated with the front end through an API gateway.'
			],
			galleryImages: [
				'/images/placeholder_image.png',
				'/images/placeholder_image2.png',
				'/images/placeholder_image3.png',
				'/images/placeholder_image4.png',
				'/images/placeholder_image5.png'
			],
			galleryLabel: 'BeaverWize screenshot gallery'
		},
		{
			id: 'laravel-nda',
			title: 'Laravel Web Application',
			subtitle: 'Laravel • MySQL • Docker • Agile Development',
			tags: ['Laravel', 'MySQL', 'Docker', 'RBAC', 'Notifications'],
			description: [
				'I was part of a team that digitalized and automated a previously manual and time-consuming process that relied on Excel sheets and paper documents. Our solution was developed for one of the largest international steel production companies. It resulted in a significantly smoother and more reliable workflow. Our application included many features such as internal data preservation and visualization. It was built on Laravel with MySQL as the database and was dockerized in later stages of development.',
				'Some of the key functionalities included secure authentication, data entry and modification, user-configurable email and push notifications, multiple sorting and filtering options, and role-based access with different permissions and views. Our solution also supported exporting data in various formats.'
			],
			note: 'Screenshots and source code are NDA-protected. I’m happy to discuss the architecture and my contributions.'
		},
		{
			id: 'portfolio',
			title: 'ivaniliev.online',
			subtitle: 'this website',
			tags: ['SvelteKit', 'Tailwind', 'Responsive', 'Animation'],
			description: [
				'A minimalist galaxy-themed portfolio built with SvelteKit + Tailwind, with a custom interactive background featuring stars, constellations, auroras, and clouds.'
			],
			links: [
				{
					label: 'GitHub',
					href: 'https://github.com/Vanishonko/ivan-iliev-portfolio',
					external: true
				}
			]
		}
	] satisfies Project[];

	const openInNewTab = (link: ProjectLink) => link.external ?? link.href.startsWith('http');

	const setBodyScroll = (locked: boolean) => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = locked ? 'hidden' : '';
		}
	};

	const openGallery = (images: string[], index: number, label = 'Project gallery') => {
		galleryImages = images;
		galleryLabel = label;
		currentImageIndex = index;
		isGalleryOpen = true;
		setBodyScroll(true);
	};

	const closeGallery = () => {
		isGalleryOpen = false;
		setBodyScroll(false);
	};

	const showPreviousImage = () => {
		if (!galleryImages.length) return;
		currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
	};

	const showNextImage = () => {
		if (!galleryImages.length) return;
		currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!isGalleryOpen) return;

		if (event.key === 'Escape') closeGallery();
		if (event.key === 'ArrowLeft') showPreviousImage();
		if (event.key === 'ArrowRight') showNextImage();
	};

	onDestroy(() => {
		setBodyScroll(false);
	});
</script>

<svelte:head>
	<title>Projects | Ivan Iliev</title>
	<meta name="description" content="A showcase of my recent projects including BeaverWize, Laravel web applications, and this portfolio." />
	<meta property="og:title" content="Projects | Ivan Iliev" />
	<meta property="og:description" content="A showcase of my recent projects including BeaverWize, Laravel web applications, and this portfolio." />
</svelte:head>

<svelte:window on:keydown={handleKeyDown} />

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
												on:click={() => openGallery(project.galleryImages ?? [], idx, project.galleryLabel)}
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

{#if isGalleryOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
		on:click={closeGallery}
		role="dialog"
		aria-modal="true"
		aria-label={galleryLabel}
	>
		<button
			type="button"
			on:click={closeGallery}
			class="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 sm:right-6 sm:top-6"
			aria-label="Close gallery"
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>

		<div
			class="relative flex w-full max-w-5xl items-center justify-center gap-3"
			on:click|stopPropagation
		>
			<button
				type="button"
				on:click={showPreviousImage}
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
				aria-label="Previous image"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<div class="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5">
				<img
					src={galleryImages[currentImageIndex]}
					alt={`Gallery image ${currentImageIndex + 1}`}
					class="max-h-[85vh] w-full object-contain"
				/>
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-sm text-white">
					{currentImageIndex + 1} / {galleryImages.length}
				</div>
			</div>

			<button
				type="button"
				on:click={showNextImage}
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
				aria-label="Next image"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>
{/if}
