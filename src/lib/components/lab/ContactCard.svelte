<script lang="ts">
	import { SITE } from '$lib/seo';

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	const copyEmail = async () => {
		try {
			await navigator.clipboard.writeText(SITE.email);
		} catch {
			// Clipboard API needs a secure context; the address is visible either way.
		}
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 2000);
	};
</script>

<div class="mt-5 rounded-xl border border-violet-300/20 bg-violet-400/[0.07] p-4">
	<p class="font-typewriter text-xs uppercase tracking-[0.18em] text-violet-200/70">get in touch</p>
	<p class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-50/85">
		<strong class="text-violet-100">Ask and you shall receive.</strong> If anything here is interesting — the
		pixel-art loop, the antenna maths, the cost arithmetic — say so and I will send you the code. I would rather
		share it with someone curious than polish it for nobody.
	</p>

	<div class="mt-4 flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={copyEmail}
			class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
		>
			{copied ? 'address copied' : `copy ${SITE.email}`}
		</button>

		<a
			href={SITE.linkedin}
			target="_blank"
			rel="noreferrer"
			class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
		>
			message on LinkedIn
		</a>

		<a
			href={SITE.github}
			target="_blank"
			rel="noreferrer"
			class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-muted-50 transition hover:border-white/25 hover:bg-white/10"
		>
			GitHub
		</a>
	</div>

	<p class="mt-3 text-xs text-muted-50/60">
		Prefer mail? <a class="underline underline-offset-4 hover:text-white" href="mailto:{SITE.email}"
			>{SITE.email}</a
		>.
	</p>
	<span class="sr-only" aria-live="polite">{copied ? 'Email address copied to the clipboard' : ''}</span>
</div>
