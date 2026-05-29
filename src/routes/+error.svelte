<script lang="ts">
	import { page } from '$app/stores';
	import { InteractiveBackground } from '$lib/components';
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
			<h1 class="text-6xl font-bold title-typewriter text-muted-50">
				{$page.status}
			</h1>
			<p class="text-lg text-muted-50/80">
				{$page.status === 404 ? 'This page does not exist.' : 'Something went wrong.'}
			</p>
			<a
				href="/"
				class="inline-block px-8 py-3 bg-muted-800 text-muted-50 rounded-full font-medium text-sm hover:bg-muted-700 transition-all duration-300 hover:shadow-lg hover:shadow-muted-300/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-muted-600 focus:ring-offset-2"
			>
				← back home
			</a>
		</div>
	</main>
</div>
