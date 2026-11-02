import { error } from '@sveltejs/kit';
import { projects } from '$lib/data/projects';

export function load({ params }: { params: { slug: string } }) {
	const project = projects.find((p) => p.id === params.slug);

	if (!project) {
		error(404, 'No such project');
	}

	return { project };
}
