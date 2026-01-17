<script lang="ts">
	import { SocialLink, AnimatedSection, InteractiveBackground } from '$lib/components';
	import { ANIMATION_DELAY, CV_INFO, SOCIAL_LINKS } from '$lib/constants';
</script>

<div class="relative h-screen overflow-hidden">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>
	<InteractiveBackground enableStars={true} enableClouds={false} enableParticles={true} enableAurora={true} />
	<main class="relative z-10 flex flex-col items-center justify-center h-screen px-6">
		<div class="max-w-2xl w-full space-y-8 content-wrapper">
			<AnimatedSection delay={ANIMATION_DELAY.TITLE} class="space-y-6 text-center">
			<h1 class="text-6xl md:text-7xl font-bold title-typewriter">
				[ivan iliev]
			</h1>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.SUBTITLE} class="text-center">
				<p class="text-xl md:text-2xl text-muted-600 font-light">
					ICT Student at HZ University of Applied Sciences
				</p>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.CTA} class="flex justify-center">
				<a
					href={CV_INFO.path}
					download={CV_INFO.filename}
					class="group relative px-8 py-3 bg-muted-800 text-muted-50 rounded-full font-medium text-sm hover:bg-muted-700 transition-all duration-300 hover:shadow-lg hover:shadow-muted-300/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-muted-600 focus:ring-offset-2"
					aria-label={CV_INFO.label}
				>
					<span class="relative z-10">Download CV</span>
					<div
						class="absolute inset-0 rounded-full bg-muted-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
						aria-hidden="true"
					></div>
				</a>
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.SOCIAL} class="flex justify-center gap-8 pt-4">
				{#each SOCIAL_LINKS as link}
					<SocialLink href={link.href} label={link.label} icon={link.icon} />
				{/each}
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.PROJECTS} class="flex justify-center pt-8">
				<nav class="flex justify-center" aria-label="Navigation">
					<a
						href="/projects"
						class="projects-link text-muted-600 hover:text-muted-900 transition-all duration-300 text-lg font-light relative inline-block focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2 rounded"
						aria-label="View portfolio projects"
					>
						<span>view projects →</span>
					</a>
				</nav>
			</AnimatedSection>
		</div>
	</main>
</div>

<style>
	.content-wrapper {
		animation: fadeIn 1.2s ease-out;
	}
</style>
