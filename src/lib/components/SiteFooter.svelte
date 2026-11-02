<script lang="ts">
	import { SOCIAL_LINKS } from '$lib/constants';

	const year = new Date().getFullYear();
</script>

<footer class="relative z-10 border-t border-white/5 bg-[#070912]/40">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-12">
		<div class="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
			<div class="space-y-2">
				<p class="flex items-baseline gap-1.5 font-typewriter text-sm uppercase tracking-[0.06em] text-[#f3f0ff]">
					ivan iliev
					<span class="inline-block h-3 w-[3px] rounded-[1px] bg-violet-300/90" aria-hidden="true"></span>
				</p>
				<p class="max-w-sm text-sm text-muted-50/70">
					ICT student at HZ University of Applied Sciences, Vlissingen. Open to work.
				</p>
			</div>

			<ul class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
				<li><a class="text-muted-50/78 underline-offset-4 hover:text-white hover:underline" href="https://ivaniliev.online">ivaniliev.online</a></li>
				{#each SOCIAL_LINKS.filter((l) => l.icon !== 'github') as link (link.href)}
					<li>
						<a class="text-muted-50/78 underline-offset-4 hover:text-white hover:underline" href={link.href}
							>{link.label.toLowerCase()}</a
						>
					</li>
				{/each}
				<li>
					<a class="text-muted-50/78 underline-offset-4 hover:text-white hover:underline" href="https://github.com/Vanishonko">github</a>
				</li>
			</ul>
		</div>

		<div class="flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-muted-50/60 sm:flex-row sm:items-center sm:justify-between">
			<p>© {year} Ivan Iliev. Built with SvelteKit and too many stars.</p>
			<p class="font-typewriter">no telemetry · no trackers · one page</p>
		</div>
	</div>
</footer>
