<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/projects', label: 'work' },
		{ href: '/lab', label: 'lab' },
		{ href: '/play', label: 'play' }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');

	// Transparent over the hero, a lit slab once you start reading. The hairline stays
	// either way so the bar never looks like a plain black strip.
	let scrolled = $state(false);

	$effect(() => {
		const onScroll = () => (scrolled = window.scrollY > 8);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<header
	class="sticky top-0 z-40 w-full transition-[background-color,border-color,box-shadow] duration-300 {scrolled
		? 'border-b border-white/10 bg-[#0d1020]/72 shadow-[0_12px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150'
		: 'border-b border-transparent bg-gradient-to-b from-[#070912]/85 via-[#070912]/45 to-transparent'}"
>
	<nav
		class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6"
		aria-label="Main"
	>
		<a href="/" class="group flex items-center gap-2" aria-label="Ivan Iliev — home">
			<span
				class="h-1.5 w-1.5 rounded-full bg-violet-300/80 shadow-[0_0_8px_2px_rgba(196,181,253,0.35)] transition group-hover:bg-violet-200"
				aria-hidden="true"
			></span>
			<span class="font-typewriter text-sm tracking-pixel text-muted-50 transition-colors group-hover:text-white sm:text-base">
				[ivan iliev]
			</span>
		</a>

		<div class="flex items-center gap-1 sm:gap-2">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-full px-3 py-1.5 text-xs transition-colors sm:text-sm {isActive(link.href)
						? 'bg-violet-400/15 text-violet-50 ring-1 ring-inset ring-violet-300/25'
						: 'text-muted-50/70 hover:bg-white/5 hover:text-muted-50'}"
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}

			<a
				href="/IlievIvanCV.pdf"
				download="IlievIvanCV.pdf"
				class="ml-1 hidden rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-center text-xs text-muted-50 transition-colors hover:border-violet-300/30 hover:bg-white/10 hover:text-white sm:inline-block sm:text-sm"
			>
				cv
			</a>
		</div>
	</nav>

	<div
		class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-300/30 to-transparent"
		aria-hidden="true"
	></div>
</header>
