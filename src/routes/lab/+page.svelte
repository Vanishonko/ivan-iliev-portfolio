<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { itemListJsonLd, socialImage } from '$lib/seo';
	import { AnimatedSection, InteractiveBackground } from '$lib/components';
	import PipPlayground from '$lib/components/lab/PipPlayground.svelte';
	import PixelArtStudio from '$lib/components/lab/PixelArtStudio.svelte';
</script>

<Seo
	 title="the lab | ivan iliev"
	 description="Private work, shown in public: Pip the pixel creature, a pixel-art surface for a coding agent, and the alerts bell that tells you what a turn cost."
	 path="/lab"
	 image={socialImage('lab')}
	jsonLd={[
		itemListJsonLd('the lab', '/lab', [
			{ name: 'Pip', path: '/lab#pip', description: 'a 32x32 creature that lives in the corner of the window' },
			{ name: 'Pixel art surface', path: '/lab#pixel-art', description: 'a model draws a character grid, looks at it, and draws again' },
			{ name: 'Alerts bell', path: '/lab#alerts', description: 'duration, tokens and estimated cost for a finished turn' }
		])]}
/>

<main class="relative">
	<InteractiveBackground enableStars enableAurora />

	<header class="px-4 pb-10 pt-12 sm:px-6 sm:pt-16">
		<div class="mx-auto w-full max-w-4xl">
			<AnimatedSection delay={80}>
				<p class="text-xs uppercase tracking-[0.2em] text-muted-50/60">the lab</p>
				<h1 class="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-muted-50 sm:text-4xl">
					Private repositories, public proof.
				</h1>
				<p class="mt-4 max-w-2xl text-sm leading-relaxed text-muted-50/70 sm:text-base">
					These are plugins for <a
						class="underline underline-offset-4 hover:text-muted-50"
						href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a
					>, the coding agent I use every day. The code lives in private repositories — partly because this is a
					workshop rather than a product, and partly because some of it is built with the agent it plugs into and
					I am not ready to defend every line of it in public. The work itself runs here.
				</p>

				<div class="mt-5 max-w-2xl rounded-xl border border-violet-300/20 bg-violet-400/[0.07] p-4">
					<p class="text-sm leading-relaxed text-muted-50/85">
						<strong class="text-violet-100">Ask and you shall receive.</strong> If anything here is interesting —
						the pixel-art loop, the antenna maths, the cost arithmetic — say so and I will send you the code. I
						would rather share it with someone curious than polish it for nobody.
						<a class="ml-1 underline underline-offset-4 hover:text-white" href="mailto:vanishonko@gmail.com"
							>Email me</a
						>.
					</p>
				</div>
			</AnimatedSection>
		</div>
	</header>

	<!-- Pip -->
	<section id="pip" class="scroll-mt-24 px-4 pb-14 sm:px-6" aria-labelledby="pip-heading">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
				<AnimatedSection delay={120}>
					<h2 id="pip-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/60">01 — pip</h2>
					<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">A creature with opinions</h3>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/70">
						Pip lives in the corner of the harness window. 32×32 pixels, 25 sheets and 113 frames: it walks,
						dozes, thinks along with the composer, celebrates a finished turn, and occasionally has to run from
						the police. It has a mood, a memory and a shadow.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/62">
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
	<section id="pixel-art" class="scroll-mt-24 px-4 pb-14 sm:px-6" aria-labelledby="art-heading">
		<div class="mx-auto w-full max-w-4xl">
			<AnimatedSection delay={80} class="max-w-2xl">
				<h2 id="art-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/60">02 — pixel art</h2>
				<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">Draw, look, draw again</h3>
				<p class="mt-3 text-sm leading-relaxed text-muted-50/70">
					The model writes a character grid — letters standing in for pixels. The plugin renders it, hands the
					image back with a critique, and the model draws a second time. There is no image model anywhere in
					the loop: it is a text model, a canvas and a feedback channel.
				</p>
				<p class="mt-3 text-sm leading-relaxed text-muted-50/62">
					The editor is the same 32×32 surface, with the same palette and the same PNG encoder — 200 lines of
					<code class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">node:</code> and nothing else. Draw
					something and take it with you.
				</p>
			</AnimatedSection>

			<AnimatedSection delay={140} class="mt-6">
				<PixelArtStudio />
			</AnimatedSection>
		</div>
	</section>

	<!-- Alerts -->
	<section id="alerts" class="scroll-mt-24 px-4 pb-16 sm:px-6" aria-labelledby="alerts-heading">
		<div class="mx-auto w-full max-w-4xl">
			<div class="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
				<AnimatedSection delay={120}>
					<h2 id="alerts-heading" class="text-xs uppercase tracking-[0.2em] text-muted-50/60">03 — alerts</h2>
					<h3 class="mt-2 text-xl text-muted-50 sm:text-2xl">A bell that knows the bill</h3>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/70">
						A turn can take four minutes. The alerts plugin rings when it lands, tells you how long it took and
						what it cost — duration, tokens and an estimated price for that run — plus a quiet pill beside every
						reply with the same arithmetic.
					</p>
					<p class="mt-3 text-sm leading-relaxed text-muted-50/62">
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
								<p class="mt-0.5 font-typewriter text-xs text-muted-50/64">4m 12s · 61.4k tokens · ~$0.38</p>
								<p class="mt-1 text-xs text-muted-50/56">pixelart — 3 drawings, 1 export</p>
							</div>
						</div>

						<div class="ml-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-50/70">
							<span class="h-1.5 w-1.5 rounded-full bg-emerald-300"></span>
							done in 12s · 2.1k tokens · ~$0.01
						</div>

						<div class="rounded-xl border border-white/5 bg-white/[0.02] p-4">
							<p class="text-xs uppercase tracking-[0.18em] text-muted-50/56">notifications</p>
							<ul class="mt-2 space-y-1 text-xs text-muted-50/62">
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
			<p class="text-sm leading-relaxed text-muted-50/64">
				Everything here lives under <a
					class="underline underline-offset-4 hover:text-muted-50"
					href="https://github.com/dsh-works">@dsh-works</a
				>, a small private organization. Bundles are built with a host half and a browser half, no runtime
				dependencies, and offline tests — the PNG and GIF encoders are written against <code
					class="rounded bg-white/10 px-1 py-0.5 text-[0.85em]">node:</code
				>
				and nothing else.
			</p>

			<p class="mt-4 text-sm leading-relaxed text-muted-50/70">
				The repositories stay private for now, but the code does not have to. If anything here caught your eye —
				Pip, the pixel-art surface, the alerts bell — <a
					class="underline underline-offset-4 hover:text-white"
					href="mailto:vanishonko@gmail.com">email me</a
				> or find me on <a
					class="underline underline-offset-4 hover:text-white"
					href="https://github.com/Vanishonko">GitHub</a
				>. I am happy to share it with anyone curious enough to ask.
			</p>
		</div>
	</section>
</main>
