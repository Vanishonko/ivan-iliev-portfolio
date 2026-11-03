/**
 * seo-audit.mjs — fetch every route from a running server and check the metadata a crawler
 * or a link preview actually reads. No dependencies; run against dev or a deployment.
 *
 *   node scripts/seo-audit.mjs                       # http://127.0.0.1:5215
 *   node scripts/seo-audit.mjs --base https://www.ivaniliev.online
 */
const args = process.argv.slice(2);
const base = (args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://127.0.0.1:5215').replace(/\/$/, '');
/** Canonical URLs must point at production, whatever host is serving the audit. */
const ORIGIN = 'https://www.ivaniliev.online';

const ROUTES = [
	'/',
	'/projects',
	'/projects/dewdrop-bend',
	'/projects/driftblock',
	'/projects/ai-f1-racing',
	'/projects/beaverwize',
	'/projects/laravel-nda',
	'/projects/dsh-works',
	'/projects/portfolio',
	'/lab',
	'/play',
	'/play/dewdrop-bend',
	'/play/driftblock',
	'/play/dragons'
];

function tag(html, re) {
	const m = html.match(re);
	return m ? m[1].trim() : null;
}

const problems = [];
const rows = [];

for (const route of ROUTES) {
	const res = await fetch(base + route, { headers: { 'user-agent': 'seo-audit' } });
	const html = await res.text();

	const title = tag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
	const description = tag(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
	const canonical = tag(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
	const ogImage = tag(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i);
	const ogUrl = tag(html, /<meta\s+property="og:url"\s+content="([^"]*)"/i);
	const robots = tag(html, /<meta\s+name="robots"\s+content="([^"]*)"/i);
	const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;

	const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
	const types = [];
	for (const block of blocks) {
		try {
			const parsed = JSON.parse(block);
			for (const item of Array.isArray(parsed) ? parsed : [parsed]) types.push(item['@type']);
		} catch {
			problems.push(`${route}: JSON-LD does not parse`);
		}
	}

	const expected = route === '/' ? `${ORIGIN}/` : `${ORIGIN}${route}`;
	rows.push({ route, status: res.status, title, canonical: canonical === expected ? 'ok' : `got ${canonical}`, og: !!ogImage, ld: types.join('+') || '-', h1: h1Count });

	if (res.status !== 200) problems.push(`${route}: HTTP ${res.status}`);
	if (!title) problems.push(`${route}: no <title>`);
	if (!description) problems.push(`${route}: no meta description`);
	if (description && (description.length < 70 || description.length > 165)) problems.push(`${route}: description length ${description.length}`);
	if (!canonical) problems.push(`${route}: no canonical`);
	else if (canonical !== expected) problems.push(`${route}: canonical ${canonical} !== ${expected}`);
	if (ogUrl !== expected) problems.push(`${route}: og:url ${ogUrl} !== ${expected}`);
	if (!ogImage) problems.push(`${route}: no og:image`);
	if (!robots?.includes('index')) problems.push(`${route}: robots "${robots}"`);
	if (h1Count !== 1) problems.push(`${route}: ${h1Count} h1 elements`);
	if (!blocks.length) problems.push(`${route}: no JSON-LD`);
}

const notFound = await fetch(base + '/this-page-does-not-exist-404');
const nfHtml = await notFound.text();
const nfRobots = tag(nfHtml, /<meta\s+name="robots"\s+content="([^"]*)"/i);
if (notFound.status !== 404) problems.push(`404 route returned ${notFound.status}`);
if (!nfRobots?.includes('noindex')) problems.push(`404 route not noindex (robots: ${nfRobots})`);

const sitemap = await fetch(base + '/sitemap.xml');
const sitemapText = await sitemap.text();
if (sitemap.status !== 200) problems.push(`sitemap: HTTP ${sitemap.status}`);
const locs = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length < ROUTES.length) problems.push(`sitemap has ${locs.length} urls, expected at least ${ROUTES.length}`);
for (const route of ROUTES) {
	const expected = route === '/' ? `${ORIGIN}/` : `${ORIGIN}${route}`;
	if (!locs.includes(expected)) problems.push(`sitemap missing ${expected}`);
}

const robotsTxt = await (await fetch(base + '/robots.txt')).text();
if (!/sitemap:\s*https:/i.test(robotsTxt)) problems.push('robots.txt has no absolute Sitemap line');

const manifest = await fetch(base + '/manifest.webmanifest');
if (manifest.status !== 200) problems.push(`manifest: HTTP ${manifest.status}`);
const manifestJson = await manifest.json().catch(() => null);
if (!manifestJson?.icons?.length) problems.push('manifest has no icons');

const icons = await Promise.all(['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'].map(async (p) => {
	const r = await fetch(base + p, { method: 'HEAD' });
	return `${p}:${r.status}`;
}));

const ogImages = await Promise.all(
	[...new Set(rows.map((r) => r.route))].slice(0, 3).map(async (route) => {
		const html = await (await fetch(base + route)).text();
		const src = tag(html, /<meta\s+property="og:image"\s+content="([^"]*)"/i);
		if (!src) return `${route}: none`;
		const r = await fetch(src.replace(ORIGIN, base), { method: 'HEAD' });
		return `${new URL(src).pathname}:${r.status}`;
	})
);

console.table(rows);
console.log('icons:', icons.join(' '), '| og images:', ogImages.join(' '));
console.log(`sitemap urls: ${locs.length}, robots: ${robotsTxt.split('\n')[0].trim()}`);
if (problems.length) {
	console.log(`\n${problems.length} problem(s):`);
	for (const p of problems) console.log(' -', p);
	process.exit(1);
}
console.log('\nall checks passed');
