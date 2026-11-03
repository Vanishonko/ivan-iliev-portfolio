import { projects } from '$lib/data/projects';
import { absolute } from '$lib/seo';

/** Prerendered at build time, so the sitemap can never drift from the project list. */
export const prerender = true;

const staticRoutes = [
	{ path: '/', priority: '1.0', changefreq: 'monthly' },
	{ path: '/projects', priority: '0.9', changefreq: 'monthly' },
	{ path: '/lab', priority: '0.8', changefreq: 'monthly' },
	{ path: '/play', priority: '0.8', changefreq: 'monthly' },
	{ path: '/play/dewdrop-bend', priority: '0.7', changefreq: 'monthly' },
	{ path: '/play/driftblock', priority: '0.7', changefreq: 'monthly' },
	{ path: '/play/dragons', priority: '0.6', changefreq: 'yearly' }
] as const;

export function GET() {
	const today = new Date().toISOString().slice(0, 10);

	const entries = [
		...staticRoutes,
		...projects.map((project) => ({
			path: `/projects/${project.id}`,
			priority: '0.8',
			changefreq: 'yearly'
		}))
	];

	const urls = entries
		.map(
			(entry) => `	<url>
		<loc>${absolute(entry.path)}</loc>
		<lastmod>${today}</lastmod>
		<changefreq>${entry.changefreq}</changefreq>
		<priority>${entry.priority}</priority>
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
