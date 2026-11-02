<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import SiteNav from '$lib/components/SiteNav.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta
		name="description"
		content="Ivan Iliev — ICT student at HZ University of Applied Sciences. Browser games, racing AI and tooling, built in Vlissingen."
	/>
	<meta property="og:title" content="Ivan Iliev" />
	<meta
		property="og:description"
		content="Browser games, racing AI and tooling. ICT student at HZ University of Applied Sciences."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://www.ivaniliev.online" />
	<meta name="theme-color" content="#070912" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="relative flex min-h-screen flex-col">
	<div class="fixed inset-0 -z-10 background-gradient" aria-hidden="true"></div>

	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-black"
	>
		Skip to content
	</a>

	<SiteNav />

	<div id="main" class="relative z-10 flex-1">
		{@render children()}
	</div>

	<SiteFooter />
</div>
