export type ProjectLink = {
	label: string;
	href: string;
	external?: boolean;
};

export type Project = {
	id: string;
	title: string;
	subtitle: string;
	tags: string[];
	description: string[];
	/** Hand-written summary for meta tags, 120-155 characters. */
	metaDescription: string;
	/** ISO date of the last real content change, when one is known. */
	updated?: string;
	links?: ProjectLink[];
	poster?: string;
	galleryImages?: string[];
	galleryAspect?: 'portrait' | 'wide';
	galleryLabel?: string;
	note?: string;
};
