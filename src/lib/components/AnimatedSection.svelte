<script lang="ts">
	import { ANIMATION_DURATION } from '$lib/constants';

	interface Props {
		delay?: string;
		duration?: string;
		class?: string;
		children: import('svelte').Snippet;
	}

	let {
		delay = '0s',
		duration = ANIMATION_DURATION.NORMAL,
		class: className = '',
		children
	}: Props = $props();
</script>

<div
	class="animated-section {className}"
	style="--animation-delay: {delay}; --animation-duration: {duration};"
>
	{@render children()}
</div>

<style>
	.animated-section {
		animation: slideUp var(--animation-duration, 1s) ease-out both;
		animation-delay: var(--animation-delay, 0s);
	}
</style>
