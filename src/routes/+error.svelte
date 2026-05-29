<script lang="ts">
	import { page } from '$app/stores';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';

	const statusChars = String($page.status).split('');
</script>

<svelte:head>
	<title>{$page.status === 404 ? 'Page Not Found' : 'Error'} | Ivan Iliev</title>
	<meta name="description" content="The page you are looking for does not exist." />
</svelte:head>

<div class="relative min-h-[100svh] overflow-hidden">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>
	<InteractiveBackground enableStars enableClouds enableAurora />
	<main class="relative z-10 flex flex-col items-center justify-center min-h-[100svh] px-4">
		<div class="max-w-md w-full space-y-6 text-center fade-in">
			<AnimatedSection delay={80} class="space-y-6 text-center">
				<h1 class="text-[clamp(3.5rem,15vw,6rem)] font-bold title-typewriter leading-[1.05]">
					<span class="inline-flex">
						{#each statusChars as char, i (i)}
							<span class="title-char">{char}</span>
						{/each}
					</span>
				</h1>
			</AnimatedSection>

			<AnimatedSection delay={140}>
				<p class="text-sm text-muted-50/80 sm:text-base">
					{$page.status === 404 ? 'This page does not exist.' : 'Something went wrong.'}
				</p>
			</AnimatedSection>

			<AnimatedSection delay={200}>
				<a
					href="/"
					class="inline-block px-8 py-3 bg-muted-800 text-muted-50 rounded-full font-medium text-sm hover:bg-muted-700 transition-all duration-300 hover:shadow-lg hover:shadow-muted-300/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-muted-600 focus:ring-offset-2"
				>
					← back home
				</a>
			</AnimatedSection>
		</div>
	</main>
</div>
