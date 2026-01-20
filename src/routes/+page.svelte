<script lang="ts">
	import { SocialLink, AnimatedSection, InteractiveBackground } from '$lib/components';
	import { ANIMATION_DELAY, CV_INFO, PAGE_SUBTITLE, PAGE_TITLE, SOCIAL_LINKS } from '$lib/constants';

	const titleWords = PAGE_TITLE.split(' ');
	const titleWordChars = titleWords.map((word) => word.split(''));
	
</script>

<div class="relative min-h-[100sh] overflow-hidden">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>
	<InteractiveBackground enableStars enableClouds enableAurora />
	<main class="relative z-10 flex flex-col items-center justify-center min-h-[100svh] px-4 sm:px-6">
		<div class="max-w-2xl w-full space-y-6 sm:space-y-8 fade-in">
			<AnimatedSection delay={ANIMATION_DELAY.TITLE} class="space-y-6 text-center">
				<h1 class="text-[clamp(1.65rem,8.5vw,3rem)] font-bold title-typewriter leading-[1.05] text-center">
					<span class="inline-flex flex-wrap justify-center gap-x-3 gap-y-2">
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

			<AnimatedSection delay={ANIMATION_DELAY.SUBTITLE} class="text-center">
				<p class="text-base sm:text-xl md:text-2xl text-muted-50 font-light subtitle-text">
					{PAGE_SUBTITLE}
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

			<AnimatedSection delay={ANIMATION_DELAY.SOCIAL} class="flex justify-center gap-6 sm:gap-8 pt-4">
				{#each SOCIAL_LINKS as link}
					<SocialLink href={link.href} label={link.label} icon={link.icon} />
				{/each}
			</AnimatedSection>

			<AnimatedSection delay={ANIMATION_DELAY.PROJECTS} class="flex justify-center pt-6 sm:pt-8">
				<nav class="flex justify-center" aria-label="Navigation">
					<a
						href="/projects"
						class="projects-link text-muted-50 hover:text-white transition-all duration-300 text-base sm:text-lg font-light relative inline-block focus:outline-none focus:ring-2 focus:ring-muted-400 focus:ring-offset-2 rounded link-text"
						aria-label="View portfolio projects"
					>
						<span>view projects →</span>
					</a>
				</nav>
			</AnimatedSection>
		</div>
	</main>
</div>
