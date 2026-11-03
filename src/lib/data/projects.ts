import type { Project } from '$lib/types';

export const projects = [
	{
		id: 'dewdrop-bend',
		year: '2026',
		role: 'solo',
		title: 'Dewdrop Bend',
		subtitle: 'Pixel-art pond • Canvas 2D • No dependencies',
		tags: ['Canvas 2D', 'Vanilla JS', 'Procedural audio', 'Pixel art'],
		description: [
			'A small, living pixel-art pond with a full 24-hour sky. Drag the clock hands through dawn, golden hour, dusk and a firefly-lit night; the sun and moon rise behind the painted ridge, the light and the stars follow, and the moon keeps its real phase.',
			'Thirteen creatures each have a hand-authored sprite, a behaviour and a field note: bees work the flowers you plant, frogs hop between lily pads, striders and tadpoles leave wakes on the water, and a single cloud button brings rain that samples the pond’s real uneven shoreline. Vanilla JavaScript and Canvas 2D — no frameworks, no runtime dependencies, no external image or sound files.'
		],
		metaDescription:
			'A living pixel-art pond with a 24-hour sky: drag the clock, plant the banks, meet thirteen hand-drawn creatures.',
		updated: '2026-10-18',
		galleryImages: ['/images/dewdrop-day.png'],
		galleryAspect: 'wide',
		galleryLabel: 'Dewdrop Bend',
		links: [
			{
				label: 'Visit the pond',
				href: '/play/dewdrop-bend'
			}
		]
	},
	{
		id: 'driftblock',
		year: '2026',
		role: 'solo',
		title: 'driftblock',
		subtitle: '3D drift racing • WebGL • No build step',
		tags: ['three.js', 'Web Audio', 'Gamepad API', 'Force feedback'],
		description: [
			'A 3D drift racing game that runs in the browser with no build step. Four circuits generated from radial harmonics, an engine synthesised entirely in Web Audio, and skid marks, smoke and sparks produced at runtime — the only imported geometry is the car body, a blocky portrait of a graphite-black Mercedes SLK with Dutch plates and a BRABUS badge.',
			'The handling is not a rigid-body simulation. Velocity is split into the car’s own forward and lateral axes, so steering rotates the car away from the direction it is actually travelling, and the slide falls out of the maths instead of being faked. On top of that sit a gearbox with real gear ratios, an engine whose revs answer the throttle rather than the tarmac, and optional force feedback through a native HID bridge, so a real wheel pushes back with a tyre model rather than a rumble.'
		],
		metaDescription:
			'A blocky 3D drift racer in the browser with no build step and no assets — procedural circuits, synthesised engine.',
		updated: '2026-10-24',
		galleryImages: ['/images/driftblock-gameplay.webp'],
		galleryAspect: 'wide',
		galleryLabel: 'driftblock gameplay',
		links: [
			{
				label: 'Play it here',
				href: '/play/driftblock'
			},
			{
				label: 'Source on GitHub',
				href: 'https://github.com/Vanishonko/driftblock',
				external: true
			}
		]
	},
	{
		id: 'ai-f1-racing',
		year: '2026',
		role: 'solo',
		title: 'ai-f1-racing',
		subtitle: 'Evolutionary racing AI • Deterministic sim',
		tags: ['TypeScript', 'Evolution Strategies', 'Neural networks', 'Determinism'],
		description: [
			'A top-down Formula 1 racing AI. A 38–16–3 neural network drives with analogue throttle, brake and steering, trained by an evolution strategy — antithetic perturbations, rank-normalised fitness, Adam on the search distribution — against a deterministic 2D simulation running at a fixed 60 Hz.',
			'Determinism is a hard contract here: any function whose result is not bit-identical across JavaScript engines is banned from the simulation, and trigonometry is baked into tables at load. That is what makes a lap time mean the same thing twice and a training run reproducible. Spa-Francorchamps and Baku are traced from the real circuits to within about 0.1 % of their true lap lengths.'
		],
		metaDescription:
			'A neural driver trained by evolution on a deterministic 2D sim, lapping circuits traced from Spa and Baku.',
		updated: '2026-10-10',
		note: 'The simulation and the trainer work — a driver can be trained to lap. Cars cannot yet see or hit each other, so the racing itself is the part still being built.',
		links: [
			{
				label: 'GitHub',
				href: 'https://github.com/Vanishonko/ai-f1-racing',
				external: true
			}
		]
	},
	{
		id: 'beaverwize',
		year: '2025',
		role: 'team',
		title: 'BeaverWize',
		subtitle: 'SvelteKit • Microservices • Gamification',
		tags: ['SvelteKit', 'Express', 'Microservices', 'API Gateway', 'Data Viz'],
		description: [
			'BeaverWize was an application developed using SvelteKit with an Express.js–based microservices architecture. It was designed to encourage people to conserve water and reduce waste by using gamification to build better habits while keeping users informed about their personal impact.',
			'The concept also focused on cooperation with sustainable brands, allowing users to exchange in-game currency for real discounts and promotions. The application featured multiple water-measuring activities, statistics, and data visualizations, as well as an achievement system that rewarded users with items to equip on their in-game character. In addition, it included a community feature that allowed users to collectively track and contribute to water-saving goals. On the backend, the system was built around individual microservices that communicated with the front end through an API gateway.'
		],
		metaDescription:
			'A gamified water-conservation app: measurements, streaks and real rewards on a SvelteKit microservice stack.',
		poster: '/images/shower.webp',
		galleryImages: [
			'/images/questionnaire.webp',
			'/images/sink.webm',
			'/images/shower.webp',
			'/images/showerstat.webp',
			'/images/gardening.webp',
			'/images/inventory.webp',
			'/images/rewards.webp',
		],
		galleryLabel: 'BeaverWize screenshot gallery'
	},
	{
		id: 'laravel-nda',
		year: '2025',
		role: 'team',
		title: 'Laravel Web Application',
		subtitle: 'Laravel • MySQL • Docker • Agile Development',
		tags: ['Laravel', 'MySQL', 'Docker', 'RBAC', 'Notifications'],
		description: [
			'I was part of a team that digitalized and automated a previously manual and time-consuming process that relied on Excel sheets and paper documents. Our solution was developed for one of the largest international steel production companies. It resulted in a significantly smoother and more reliable workflow. Our application included many features such as internal data preservation and visualization. It was built on Laravel with MySQL as the database and was dockerized in later stages of development.',
			'Some of the key functionalities included secure authentication, data entry and modification, user-configurable email and push notifications, multiple sorting and filtering options, and role-based access with different permissions and views. Our solution also supported exporting data in various formats.'
		],
		metaDescription:
			'An NDA Laravel application that replaced spreadsheets for a steel producer: RBAC, notifications and exports.',
		note: 'Screenshots and source code are NDA-protected. I’m happy to discuss the architecture and my contributions.'
	},
	{
		id: 'dsh-works',
		year: '2026',
		role: 'solo',
		title: 'dsh-works plugins',
		subtitle: 'DeepSeek Harness • Private workshop',
		tags: ['Node.js', 'Svelte', 'Pixel art', 'Offline tests'],
		description: [
			'Plugins for DeepSeek Harness, built as bundles with a host half and a browser half: a pixel-art surface where the model draws a character grid, looks at the rendered image, gets a critique and draws again; a 32×32 creature that lives in the corner of the window and reacts to what the agent is doing; and an alerts bell that reports the duration, tokens and estimated cost of a turn.',
			'No runtime dependencies — the PNG and GIF encoders are written against node: — and every suite runs offline, with no model and no network.'
		],
		metaDescription:
			'Private plugins for DeepSeek Harness: a pixel-art surface, a 32×32 creature, and an alerts bell that counts cost.',
		note: 'The repositories are private; the organization page is public.',
		links: [
			{
				label: 'See them running',
				href: '/lab'
			},
			{
				label: 'dsh-works',
				href: 'https://github.com/dsh-works',
				external: true
			}
		]
	},
	{
		id: 'portfolio',
		year: '2026',
		role: 'solo',
		title: 'ivaniliev.online',
		subtitle: 'this website',
		tags: ['SvelteKit', 'Tailwind', 'Responsive', 'Animation'],
		description: [
			'A minimalist galaxy-themed portfolio built with SvelteKit + Tailwind, with a custom interactive background featuring stars, constellations, auroras, and clouds.'
		],
		metaDescription:
			'This site: a SvelteKit portfolio with a canvas sky, prerendered pages and no trackers anywhere in it.',
		links: [
			{
				label: 'GitHub',
				href: 'https://github.com/Vanishonko/ivan-iliev-portfolio',
				external: true
			}
		]
	}
] satisfies Project[];
