<script lang="ts">
	import { AnimatedSection, InteractiveBackground } from '$lib/components';
	import PipPlayground from '$lib/components/lab/PipPlayground.svelte';
	import PixelArtStudio from '$lib/components/lab/PixelArtStudio.svelte';
</script>

<svelte:head>
	<title>The lab | Ivan Iliev</title>
	<meta
		name="description"
		content="Private work, shown in public: Pip the pixel creature, a pixel-art surface for a coding agent, and the alerts bell that tells you what a turn cost."
	/>
	<meta property="og:title" content="The lab | Ivan Iliev" />
	<meta
		property="og:description"
		content="Pip, the pixel-art surface and the alerts bell — plugins I build for DeepSeek Harness."
	/>
</svelte:head>

<main class="relative">
	<InteractiveBackground enableStars enableAurora />

	<header class="px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
		<div class="mx-auto w-full max-w-4xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/40">the lab</p>
				<h1 class="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-muted-50 sm:text-4xl">
					Work I can't open-source, but can still show you.
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-50/60 sm:text-base">
					These are plugins for <a
						class="underline underline-offset-4 hover:text-muted-50"
						href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a
					>, the coding agent I use every day. The repositories are private. So instead of screenshots of a
					repository you can't open, here are the pieces themselves — running.
				</p>
			</AnimatedSection>
		</div>
	</header>

	<!-- Pip -->
	<section class="px-4 pb-14 sm:px-6" aria-labelledby="pip-heading">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
				<AnimatedSection delay={120}>
					<h2 id="pip-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/40">01 — pip</h2>
					<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">A creature with opinions</h3>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/60">
						Pip lives in the corner of the harness window. 32×32 pixels, 25 sheets and 113 frames: it walks,
						dozes, thinks along with the composer, celebrates a finished turn, and occasionally has to run from
						the police. It has a mood, a memory and a shadow.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/45">
						This one is the real sprite data — the same sheets the plugin ships, playing on the same per-frame
						timings. Go on, poke him.
					</p>
				</AnimatedSection>

				<AnimatedSection delay={180}>
					<PipPlayground />
				</AnimatedSection>
			</div>
		</div>
	</section>

	<!-- Pixel art -->
	<section class="px-4 pb-14 sm:px-6" aria-labelledby="art-heading">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
				<AnimatedSection delay={120} class="order-2 lg:order-1">
					<PixelArtStudio />
				</AnimatedSection>

				<AnimatedSection delay={80} class="order-1 lg:order-2">
					<h2 id="art-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/40">02 — pixel art</h2>
					<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">Draw, look, draw again</h3>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/60">
						The model writes a character grid — letters standing in for pixels. The plugin renders it, hands the
						image back with a critique, and the model draws a second time. There is no image model anywhere in
						the loop: it is a text model, a canvas and a feedback channel.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/45">
						The editor is the same 32×32 surface, with the same palette and the same PNG encoder — 200 lines of
						<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">node:</code> and nothing else. Draw
						something and take it with you.
					</p>
				</AnimatedSection>
			</div>
		</div>
	</section>

	<!-- Alerts -->
	<section class="px-4 pb-16 sm:px-6" aria-labelledby="alerts-heading">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
				<AnimatedSection delay={120}>
					<h2 id="alerts-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/40">03 — alerts</h2>
					<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">A bell that knows the bill</h3>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/60">
						A turn can take four minutes. The alerts plugin rings when it lands, tells you how long it took and
						what it cost — duration, tokens and an estimated price for that run — plus a quiet pill beside every
						reply with the same arithmetic.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/45">
						Chime, desktop notification, tab-title marker. No telemetry, no account, no dashboard to log into.
					</p>
				</AnimatedSection>

				<AnimatedSection delay={180}>
					<div class="mx-auto w-full max-w-sm space-y-3">
						<div class="flex items-start gap-3 rounded-xl border border-white/10 bg-[#11131c]/90 p-4 shadow-xl shadow-black/30 backdrop-blur">
							<span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-200">
								<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
									<path d="M13.7 21a2 2 0 01-3.4 0" />
								</svg>
							</span>
							<div class="min-w-0">
								<p class="text-sm text-muted-50">Turn complete</p>
								<p class="mt-0.5 font-typewriter text-xs text-muted-50/50">4m 12s · 61.4k tokens · ~$0.38</p>
								<p class="mt-1 text-xs text-muted-50/30">pixelart — 3 drawings, 1 export</p>
							</div>
						</div>

						<div class="ml-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-50/60">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-300"></span>
							done in 12s · 2.1k tokens · ~$0.01
						</div>

						<div class="rounded-xl border border-white/5 bg-white/[0.02] p-4">
							<p class="text-xs uppercase tracking-[0.18em] text-muted-50/30">notifications</p>
							<ul class="mt-2 space-y-1 text-xs text-muted-50/45">
								<li>· chime — a bell, not a buzzer</li>
								<li>· desktop toast — if the tab is in the background</li>
								<li>· tab title — a dot while a turn is running</li>
							</ul>
						</div>
					</div>
				</AnimatedSection>
			</div>
		</div>
	</section>

	<section class="px-4 pb-24 sm:px-6">
		<div class="mx-auto w-full max-w-4xl rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
			<p class="text-sm leading-relaxed text-muted-50/50">
				Everything here lives under <a
					class="underline underline-offset-4 hover:text-muted-50"
					href="https://github.com/dsh-works">@dsh-works</a
				>, a small private organization. Bundles are built with a host half and a browser half, no runtime
				dependencies, and offline tests — the PNG and GIF encoders are written against <code
					class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">node:</code
				>
				and nothing else.
			</p>
		</div>
	</section>
</main>
