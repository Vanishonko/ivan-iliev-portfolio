import { error } from '@sveltejs/kit';
import { projects } from '$lib/data/projects';

/** Prerender needs to be told which dynamic pages exist. */
export const entries = () => projects.map((project) => ({ slug: project.id }));

export function load({ params }: { params: { slug: string } }) {
	const project = projects.find((p) => p.id === params.slug);

	if (!project) {
		error(404, 'No such project');
	}

	return { project };
}
