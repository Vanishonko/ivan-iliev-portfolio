<script lang="ts">
	import { absolute, personJsonLd, SITE, socialImage, type JsonLd } from '$lib/seo';

	let {
		title,
		description,
		path,
		image = socialImage('home'),
		type = 'website',
		noindex = false,
		jsonLd = []
	}: {
		title: string;
		description: string;
		path: string;
		image?: string;
		type?: 'website' | 'article' | 'profile';
		noindex?: boolean;
		jsonLd?: JsonLd[];
	} = $props();

	/*
	 * Svelte renders everything inside a template `<script>` element as raw text, so the
	 * JSON-LD block cannot be a template tag with an expression in it — it enters the
	 * document as HTML instead, just after the component. That is valid: search engines
	 * read JSON-LD anywhere in the document, and it keeps the head free of escaped markup.
	 */
	const blocks = $derived([personJsonLd(), ...jsonLd]);
	const ldScripts = $derived(
		blocks
			.map(
				(data) =>
					`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}<\/script>`
			)
			.join('')
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />

	{#if noindex}
		<meta name="robots" content="noindex, follow" />
	{:else}
		<meta name="robots" content="index, follow, max-image-preview:large" />
		<link rel="canonical" href={absolute(path)} />
	{/if}

	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if !noindex}
		<meta property="og:url" content={absolute(path)} />
	{/if}
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:alt" content={title} />
	<meta property="og:locale" content={SITE.locale} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

{@html ldScripts}
