<script lang="ts">
	let {
		delay = '0s',
		duration = '1s',
		class: className = '',
		children
	}: {
		delay?: string | number;
		duration?: string | number;
		class?: string;
		children: import('svelte').Snippet;
	} = $props();

	// numbers are milliseconds; strings are used verbatim ("0.4s")
	const toCss = (value: string | number) => (typeof value === 'number' ? `${value}ms` : value);
</script>

<div
	class="animated-section {className}"
	style="--animation-delay: {toCss(delay)}; --animation-duration: {toCss(duration)};"
>
	{@render children()}
</div>

<style>
	.animated-section {
		animation: slideUp var(--animation-duration, 1s) ease-out both;
		animation-delay: var(--animation-delay, 0s);
	}
</style>
