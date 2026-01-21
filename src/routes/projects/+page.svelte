<script lang="ts">
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
	};

	const projects = [
		{
			id: 'beaverwize',
			title: 'BeaverWize',
			subtitle: 'SvelteKit • Microservices • Gamification',
			tags: ['SvelteKit', 'Express', 'Microservices', 'API Gateway', 'Data Viz'],
			description: [
				'BeaverWize was an application developed using SvelteKit with an Express.js–based microservices architecture. It was designed to encourage people to conserve water and reduce waste by using gamification to build better habits while keeping users informed about their personal impact.',
				'The concept also focused on cooperation with sustainable brands, allowing users to exchange in-game currency for real discounts and promotions. The application featured multiple water-measuring activities, statistics, and data visualizations, as well as an achievement system that rewarded users with items to equip on their in-game character. In addition, it included a community feature that allowed users to collectively track and contribute to water-saving goals. On the backend, the system was built around individual microservices that communicated with the front end through an API gateway.'
			]
		},
		{
			id: 'laravel-nda',
			title: 'Laravel Web Application',
			subtitle: 'Laravel • MySQL • Docker • Agile Development',
			tags: ['Laravel', 'MySQL', 'Docker', 'RBAC', 'Notifications'], 
			description: [
				'I was part of a team that digitalized and automated a previously manual and time-consuming process that relied on Excel sheets and paper documents. Our solution was developed for one of the largest international steel production companies. It resulted in a significantly smoother and more reliable workflow. Our application included many features such as internal data preservation and visualization. It was built on Laravel with MySQL as the database and was dockerized in later stages of development.',
				'Some of the key functionalities included secure authentication, data entry and modification, user-configurable email and push notifications, multiple sorting and filtering options, and role-based access with different permissions and views. Our solution also supported exporting data in various formats.'
			]
		},
		{
			id: 'portfolio',
			title: 'ivaniliev.online',
			subtitle: 'This website',
			tags: ['SvelteKit', 'Tailwind', 'Responsive', 'Animation'],
			description: [
				'A minimalist galaxy-themed portfolio built with SvelteKit + Tailwind, with a custom interactive background (stars, constellations, auroras, clouds).'
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
</script>

<div class="relative min-h-[100svh] overflow-x-hidden">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>
	<InteractiveBackground enableStars enableClouds enableAurora />

	<main class="relative z-10 px-4 sm:px-6 py-12 sm:py-16">
		<div class="mx-auto w-full max-w-3xl space-y-10 sm:space-y-12 fade-in">
			<header class="space-y-3 text-center">
				<AnimatedSection delay={80}>
					<h1 class="text-[clamp(1.65rem,8.5vw,3rem)] font-bold title-typewriter leading-[1.05] text-center">
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
					<p class="text-muted-50/80 text-sm sm:text-base">
						a few of my recent tinkerings.
                    </p>                
                </AnimatedSection>
			</header>

			<section class="space-y-6 sm:space-y-8" aria-label="Project list">
				{#each projects as project, i (project.id)}
					<AnimatedSection delay={200 + i * 90}>
						<article class="rounded-2xl border border-white/10 bg-muted-900/20 backdrop-blur-md shadow-sm p-6 sm:p-8">
							<header class="flex flex-col gap-3 sm:gap-4">
								<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
									<div class="space-y-1">
										<div class="flex items-center justify-center sm:justify-start gap-2">
											<h2 class="text-xl sm:text-2xl font-semibold text-muted-50">{project.title}</h2>
										</div>
										<p class="text-muted-50/70 text-sm">{project.subtitle}</p>
									</div>

									<div class="flex flex-wrap justify-center sm:justify-end gap-2">
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

							{#if project.id === 'beaverwize'}
								<div class="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-50/75">
									screenshots gallery - coming soon!
								</div>
							{/if}

							{#if project.id === 'laravel-nda'}
								<p class="mt-6 text-sm text-muted-50/70">
									Screenshots and source code are NDA-protected. I’m happy to discuss architecture and my contributions.
								</p>
							{/if}

							{#if project.links?.length}
								<div class="mt-6 flex flex-wrap justify-center sm:justify-start gap-4">
									{#each project.links as link (link.href)}
										<a
											href={link.href}
											target={openInNewTab(link) ? '_blank' : undefined}
											rel={openInNewTab(link) ? 'noreferrer' : undefined}
											class="projects-link link-text text-muted-50 hover:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2 rounded"
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
						class="projects-link link-text text-muted-50 hover:text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2 rounded"
						aria-label="Back to home"
					>
						← back home
					</a>
				</AnimatedSection>
			</footer>
		</div>
	</main>
</div>
