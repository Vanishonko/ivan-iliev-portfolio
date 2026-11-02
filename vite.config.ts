import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		watch: {
			// editors and agents that write atomically drop `.name.<pid>.tmpdir` folders next to
			// the file; watching them can crash the dev server on Windows with EBUSY.
			ignored: ['**/.*.tmpdir/**', '**/*.tmp']
		}
	}
});
