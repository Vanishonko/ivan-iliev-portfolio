import type { Project } from '$lib/types';

export const projects = [
	{
		id: 'beaverwize',
		title: 'BeaverWize',
		subtitle: 'SvelteKit • Microservices • Gamification',
		tags: ['SvelteKit', 'Express', 'Microservices', 'API Gateway', 'Data Viz'],
		description: [
			'BeaverWize was an application developed using SvelteKit with an Express.js–based microservices architecture. It was designed to encourage people to conserve water and reduce waste by using gamification to build better habits while keeping users informed about their personal impact.',
			'The concept also focused on cooperation with sustainable brands, allowing users to exchange in-game currency for real discounts and promotions. The application featured multiple water-measuring activities, statistics, and data visualizations, as well as an achievement system that rewarded users with items to equip on their in-game character. In addition, it included a community feature that allowed users to collectively track and contribute to water-saving goals. On the backend, the system was built around individual microservices that communicated with the front end through an API gateway.'
		],
		galleryImages: [
			'/images/placeholder_image.png',
			'/images/placeholder_image2.png',
			'/images/placeholder_image3.png',
			'/images/placeholder_image4.png',
			'/images/placeholder_image5.png'
		],
		galleryLabel: 'BeaverWize screenshot gallery'
	},
	{
		id: 'laravel-nda',
		title: 'Laravel Web Application',
		subtitle: 'Laravel • MySQL • Docker • Agile Development',
		tags: ['Laravel', 'MySQL', 'Docker', 'RBAC', 'Notifications'],
		description: [
			'I was part of a team that digitalized and automated a previously manual and time-consuming process that relied on Excel sheets and paper documents. Our solution was developed for one of the largest international steel production companies. It resulted in a significantly smoother and more reliable workflow. Our application included many features such as internal data preservation and visualization. It was built on Laravel with MySQL as the database and was dockerized in later stages of development.',
			'Some of the key functionalities included secure authentication, data entry and modification, user-configurable email and push notifications, multiple sorting and filtering options, and role-based access with different permissions and views. Our solution also supported exporting data in various formats.'
		],
		note: 'Screenshots and source code are NDA-protected. I’m happy to discuss the architecture and my contributions.'
	},
	{
		id: 'portfolio',
		title: 'ivaniliev.online',
		subtitle: 'this website',
		tags: ['SvelteKit', 'Tailwind', 'Responsive', 'Animation'],
		description: [
			'A minimalist galaxy-themed portfolio built with SvelteKit + Tailwind, with a custom interactive background featuring stars, constellations, auroras, and clouds.'
		],
		links: [
			{
				label: 'GitHub',
				href: 'https://github.com/Vanishonko/ivan-iliev-portfolio',
				external: true
			}
		]
	}
] satisfies Project[];
