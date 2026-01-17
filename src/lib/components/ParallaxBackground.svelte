<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { PARALLAX_RATE } from '$lib/constants';

	let parallaxContainer: HTMLElement | null = null;
	let animationFrameId: number | null = null;

	const updateBackgroundHeight = (): void => {
		if (!parallaxContainer || !browser) return;

		const documentHeight = Math.max(
			document.body.scrollHeight,
			document.body.offsetHeight,
			document.documentElement.clientHeight,
			document.documentElement.scrollHeight,
			document.documentElement.offsetHeight
		);

		const extraHeight = Math.abs(PARALLAX_RATE) * documentHeight;
		parallaxContainer.style.height = `${documentHeight + extraHeight}px`;
	};

	const handleScroll = (): void => {
		if (!parallaxContainer || !browser) return;

		try {
			const scrolled = window.pageYOffset;
			const translateY = scrolled * PARALLAX_RATE;

			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
			}

			animationFrameId = requestAnimationFrame(() => {
				if (parallaxContainer) {
					parallaxContainer.style.transform = `translateY(${translateY}px)`;
				}
			});
		} catch (error) {
			console.error('Parallax scroll handler error:', error);
		}
	};

	onMount(() => {
		if (!browser) return;

		updateBackgroundHeight();
		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', updateBackgroundHeight, { passive: true });

		const resizeObserver = new ResizeObserver(() => {
			updateBackgroundHeight();
		});
		resizeObserver.observe(document.body);

		return () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', updateBackgroundHeight);
			resizeObserver.disconnect();
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
		};
	});
</script>

<div
	bind:this={parallaxContainer}
	class="fixed inset-x-0 top-0 -z-10 parallax-background"
	aria-hidden="true"
>
	<div class="absolute inset-0 background-base"></div>

	<div class="absolute inset-0 background-depth">
		<div class="depth-layer depth-1"></div>
		<div class="depth-layer depth-2"></div>
	</div>
</div>

<style>
	.background-base {
		background: linear-gradient(
			180deg,
			#e0f2fe 0%,
			#bae6fd 25%,
			#93c5fd 50%,
			#7dd3fc 75%,
			#60a5fa 100%
		);
	}

	.depth-layer {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse 1000px 600px at center,
			rgba(186, 230, 253, 0.2) 0%,
			rgba(147, 197, 253, 0.15) 30%,
			rgba(125, 211, 252, 0.1) 50%,
			transparent 80%
		);
		animation: depth-pulse 8s ease-in-out infinite;
	}

	.depth-1 {
		animation-duration: 10s;
		animation-delay: 0s;
	}

	.depth-2 {
		animation-duration: 12s;
		animation-delay: -4s;
		transform: scale(1.2);
	}
</style>
