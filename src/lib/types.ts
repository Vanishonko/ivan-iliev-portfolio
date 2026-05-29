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
	links?: ProjectLink[];
	galleryImages?: string[];
	galleryLabel?: string;
	note?: string;
};
