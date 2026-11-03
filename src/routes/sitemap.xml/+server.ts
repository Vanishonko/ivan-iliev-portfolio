import { projects } from '$lib/data/projects';
import { absolute } from '$lib/seo';

/** Prerendered at build time, so the sitemap can never drift from the project list. */
export const prerender = true;

const staticRoutes = [
	{ path: '/' },
	{ path: '/projects' },
	{ path: '/lab' },
	{ path: '/play' },
	{ path: '/play/dewdrop-bend' },
	{ path: '/play/driftblock' },
	{ path: '/play/dragons' }
] as const;

export function GET() {
	const entries = [
		...staticRoutes.map((route) => ({ path: route.path, updated: undefined as string | undefined })),
		...projects.map((project) => ({ path: `/projects/${project.id}`, updated: project.updated }))
	];

	const urls = entries
		.map(
			(entry) => `	<url>
		<loc>${absolute(entry.path)}</loc>${entry.updated ? `\n\t\t<lastmod>${entry.updated}</lastmod>` : ''}
	</url>`
		)
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=0, must-revalidate'
		}
	});
}
