<script lang="ts">
	import { SVG_ICON_PATHS, type SocialIcon } from '$lib/constants';

	interface Props {
		href: string;
		label: string;
		icon: SocialIcon;
	}

	let { href, label, icon }: Props = $props();
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class="social-icon text-muted-50 hover:text-white transition-all duration-300 hover:scale-110"
	aria-label={label}
>
	<svg
		class="w-6 h-6"
		fill="currentColor"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
	>
		<path d={SVG_ICON_PATHS[icon]} />
	</svg>
</a>

<style>
	.social-icon {
		filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.2));
		transition: filter 0.3s ease, transform 0.3s ease, color 0.3s ease;
	}

	.social-icon:hover {
		filter: 
			drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))
			drop-shadow(0 0 12px rgba(219, 39, 119, 0.4))
			drop-shadow(0 0 16px rgba(168, 85, 247, 0.3));
	}
</style>
