/**
 * seo-audit.mjs — fetch every route from a running server and check the metadata a crawler
 * or a link preview actually reads. No dependencies; run against dev, preview or production.
 *
 *   node scripts/seo-audit.mjs                                   # http://127.0.0.1:5215
 *   node scripts/seo-audit.mjs --base https://www.ivaniliev.online
 *
 * Exits 1 on any problem, so it can be wired into CI as a release gate.
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

const problems = [];
const rows = [];

const all = (html, re) => [...html.matchAll(re)].map((m) => m[1].trim());
const one = (html, re) => {
	const found = all(html, re);
	return found.length === 1 ? found[0] : null;
};
const expectedFor = (route) => (route === '/' ? `${ORIGIN}/` : `${ORIGIN}${route}`);

function pngSize(buffer) {
	if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const titles = new Map();
const descriptions = new Map();
const ogImages = new Map();

for (const route of ROUTES) {
	const res = await fetch(base + route, { headers: { 'user-agent': 'seo-audit' } });
	const html = await res.text();

	// Every tag of each kind must appear exactly once: duplicates are invisible to a naive
	// "first match" regex, and this site shipped that bug once already.
	const counts = {
		title: all(html, /<title[^>]*>([\s\S]*?)<\/title>/gi).length,
		description: all(html, /<meta\s+name="description"\s+content="([^"]*)"/gi).length,
		canonical: all(html, /<link\s+rel="canonical"\s+href="([^"]*)"/gi).length,
		robots: all(html, /<meta\s+name="robots"\s+content="([^"]*)"/gi).length,
		ogImage: all(html, /<meta\s+property="og:image"\s+content="([^"]*)"/gi).length,
		ogUrl: all(html, /<meta\s+property="og:url"\s+content="([^"]*)"/gi).length
	};
	for (const [name, count] of Object.entries(counts)) {
		if (count !== 1) problems.push(`${route}: ${count} ${name} tags`);
	}

	const title = one(html, /<title[^>]*>([\s\S]*?)<\/title>/gi);
	const description = one(html, /<meta\s+name="description"\s+content="([^"]*)"/gi);
	const canonical = one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/gi);
	const robots = one(html, /<meta\s+name="robots"\s+content="([^"]*)"/gi);
	const ogUrl = one(html, /<meta\s+property="og:url"\s+content="([^"]*)"/gi);
	const ogImage = one(html, /<meta\s+property="og:image"\s+content="([^"]*)"/gi);
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

	const expected = expectedFor(route);
	rows.push({ route, status: res.status, title, canonical: canonical === expected ? 'ok' : 'bad', ld: types.join('+') || '-', h1: h1Count });

	if (res.status !== 200) problems.push(`${route}: HTTP ${res.status}`);
	if (title && (title.length < 12 || title.length > 65)) problems.push(`${route}: title length ${title.length}`);
	if (description && (description.length < 70 || description.length > 165)) problems.push(`${route}: description length ${description.length}`);
	if (description && !/[.!?…]$/.test(description)) problems.push(`${route}: description does not end a sentence`);
	if (description && /\s\w{1,3}$/.test(description)) problems.push(`${route}: description ends mid-word`);
	if (canonical !== expected) problems.push(`${route}: canonical ${canonical} !== ${expected}`);
	if (ogUrl !== expected) problems.push(`${route}: og:url ${ogUrl} !== ${expected}`);
	if (!robots?.includes('index')) problems.push(`${route}: robots "${robots}"`);
	if (h1Count !== 1) problems.push(`${route}: ${h1Count} h1 elements`);

	if (title) {
		if (titles.has(title)) problems.push(`${route}: duplicate title (same as ${titles.get(title)})`);
		else titles.set(title, route);
	}
	if (description) {
		if (descriptions.has(description)) problems.push(`${route}: duplicate description (same as ${descriptions.get(description)})`);
		else descriptions.set(description, route);
	}
	if (ogImage) ogImages.set(route, ogImage);
}

// 404: real status, noindex, and no canonical pointing at a page that does not exist.
const notFound = await fetch(base + '/this-page-does-not-exist-404');
const nfHtml = await notFound.text();
const nfRobots = one(nfHtml, /<meta\s+name="robots"\s+content="([^"]*)"/gi);
const nfCanonical = one(nfHtml, /<link\s+rel="canonical"\s+href="([^"]*)"/gi);
if (notFound.status !== 404) problems.push(`404 route returned ${notFound.status}`);
if (!nfRobots?.includes('noindex')) problems.push(`404 route not noindex (robots: ${nfRobots})`);
if (nfCanonical) problems.push(`404 route declares a canonical (${nfCanonical})`);

// Sitemap: every canonical URL is in it, and every URL it lists resolves.
const sitemap = await fetch(base + '/sitemap.xml');
const sitemapText = await sitemap.text();
if (sitemap.status !== 200) problems.push(`sitemap: HTTP ${sitemap.status}`);
const locs = all(sitemapText, /<loc>([^<]+)<\/loc>/g);
for (const route of ROUTES) {
	const expected = expectedFor(route);
	if (!locs.includes(expected)) problems.push(`sitemap missing ${expected}`);
}
for (const loc of locs) {
	const res = await fetch(loc.replace(ORIGIN, base), { method: 'HEAD' });
	if (res.status !== 200) problems.push(`sitemap lists ${loc} which returns ${res.status}`);
}

// Social cards: every one must exist, be a PNG, and be exactly 1200x630.
for (const [route, url] of ogImages) {
	const res = await fetch(url.replace(ORIGIN, base));
	if (!res.ok) {
		problems.push(`${route}: og:image ${url} -> ${res.status}`);
		continue;
	}
	const size = pngSize(Buffer.from(await res.arrayBuffer()));
	if (!size) problems.push(`${route}: og:image is not a PNG`);
	else if (size.width !== 1200 || size.height !== 630) problems.push(`${route}: og:image is ${size.width}x${size.height}`);
}

const robotsTxt = await (await fetch(base + '/robots.txt')).text();
if (!/sitemap:\s*https:/i.test(robotsTxt)) problems.push('robots.txt has no absolute Sitemap line');

const manifest = await fetch(base + '/manifest.webmanifest');
if (manifest.status !== 200) problems.push(`manifest: HTTP ${manifest.status}`);
const manifestJson = await manifest.json().catch(() => null);
if (!manifestJson?.icons?.length) problems.push('manifest has no icons');

for (const path of ['/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']) {
	const res = await fetch(base + path, { method: 'HEAD' });
	if (res.status !== 200) problems.push(`${path} -> ${res.status}`);
}

// The vendored game shells are public but must never be indexed as thin duplicates.
for (const path of ['/games/dewdrop-bend/index.html', '/games/dragons/start.html']) {
	const res = await fetch(base + path);
	const html = await res.text();
	if (res.status !== 200) continue;
	const robots = one(html, /<meta\s+name="robots"\s+content="([^"]*)"/gi);
	if (!robots?.includes('noindex')) problems.push(`${path} is indexable`);
	if (!one(html, /<link\s+rel="canonical"\s+href="([^"]*)"/gi)) problems.push(`${path} has no canonical`);
}

console.table(rows);
console.log(`sitemap urls: ${locs.length} | cards: ${ogImages.size}`);
if (problems.length) {
	console.log(`\n${problems.length} problem(s):`);
	for (const p of problems) console.log(' -', p);
	process.exit(1);
}
console.log('\nall checks passed');
