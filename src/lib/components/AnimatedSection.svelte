<script lang="ts">
	let {
		delay = '0s',
		duration = '1s',
		class: className = '',
		children
	}: {
		delay?: string;
		duration?: string;
		class?: string;
		children: import('svelte').Snippet;
	} = $props();
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
