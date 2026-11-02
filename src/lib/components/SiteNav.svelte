<script lang="ts">
	import { page } from '$app/state';

	const links = [
		{ href: '/projects', label: 'work' },
		{ href: '/lab', label: 'lab' },
		{ href: '/play/driftblock', label: 'play' }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<header class="sticky top-0 z-40 w-full border-b border-white/5 bg-[#070912]/70 backdrop-blur-md">
	<nav
		class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6"
		aria-label="Main"
	>
		<a
			href="/"
			class="font-typewriter text-sm tracking-pixel text-muted-50 transition-colors hover:text-white sm:text-base"
			aria-label="Ivan Iliev — home"
		>
			[ivan iliev]
		</a>

		<div class="flex items-center gap-1 sm:gap-2">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="rounded-full px-3 py-1.5 text-xs transition-colors sm:text-sm {isActive(link.href)
						? 'bg-white/10 text-white'
						: 'text-muted-50/60 hover:bg-white/5 hover:text-muted-50'}"
					aria-current={isActive(link.href) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}

			<a
				href="/IlievIvanCV.pdf"
				download="IlievIvanCV.pdf"
				class="ml-1 hidden rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-center text-xs text-muted-50 transition-colors hover:border-white/25 hover:bg-white/10 sm:inline-block sm:text-sm"
			>
				cv
			</a>
		</div>
	</nav>
</header>
