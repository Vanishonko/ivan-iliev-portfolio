export { default as AnimatedSection } from './AnimatedSection.svelte';
export { default as InteractiveBackground } from './InteractiveBackground.svelte';
export { default as Gallery } from './Gallery.svelte';

// NOTE: `SocialLink.svelte` is intentionally not in this barrel — `constants.ts` already
// exports a `SocialLink` type, and re-exporting both from `$lib` is ambiguous. Import the
// component by path if you need it.