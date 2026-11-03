// Everything on this site is static content: no server data, no per-user anything.
// Prerendering turns each route into HTML at build time, which is what crawlers and
// link previews read first.
export const prerender = true;

// No trailing slashes: one canonical URL per page.
export const trailingSlash = 'never';
