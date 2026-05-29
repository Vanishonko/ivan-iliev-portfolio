<script lang="ts">
	import { onDestroy } from 'svelte';

	let {
		images,
		label = 'Project gallery',
		open,
		onclose
	}: {
		images: string[];
		label?: string;
		open: boolean;
		onclose: () => void;
	} = $props();

	let currentIndex = $state(0);

	const setBodyScroll = (locked: boolean) => {
		if (typeof document !== 'undefined') {
			document.body.style.overflow = locked ? 'hidden' : '';
		}
	};

	const showPrevious = () => {
		currentIndex = (currentIndex - 1 + images.length) % images.length;
	};

	const showNext = () => {
		currentIndex = (currentIndex + 1) % images.length;
	};

	const handleKeyDown = (event: KeyboardEvent) => {
		if (!open) return;
		if (event.key === 'Escape') onclose();
		if (event.key === 'ArrowLeft') showPrevious();
		if (event.key === 'ArrowRight') showNext();
	};

	$effect(() => {
		setBodyScroll(open);
	});

	const isVideo = (path: string) => path.endsWith('.webm');

	onDestroy(() => {
		setBodyScroll(false);
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
		onclick={onclose}
		role="dialog"
		aria-modal="true"
		aria-label={label}
		tabindex="-1"
	>
		<button
			type="button"
			onclick={onclose}
			class="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 sm:right-6 sm:top-6"
			aria-label="Close gallery"
		>
			<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>

		<div
			class="relative flex w-full max-w-5xl items-center justify-center gap-3"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<button
				type="button"
				onclick={showPrevious}
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
				aria-label="Previous image"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>

			<div class="relative flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5">
				{#if isVideo(images[currentIndex])}
					<video
						src={images[currentIndex]}
						class="max-h-[85vh] w-full object-contain"
						autoplay
						loop
						muted
						playsinline
					></video>
				{:else}
					<img
						src={images[currentIndex]}
						alt={`Gallery image ${currentIndex + 1}`}
						class="max-h-[85vh] w-full object-contain"
					/>
				{/if}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-sm text-white">
					{currentIndex + 1} / {images.length}
				</div>
			</div>

			<button
				type="button"
				onclick={showNext}
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-300 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
				aria-label="Next image"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	</div>
{/if}
