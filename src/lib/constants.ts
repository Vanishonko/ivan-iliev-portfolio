export const PARALLAX_RATE = -0.5;

export const ANIMATION_DURATION = {
	FAST: '0.3s',
	NORMAL: '1s',
	SLOW: '1.2s'
} as const;

export const ANIMATION_EASING = {
	DEFAULT: 'ease-out',
	SMOOTH: 'cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

export const ANIMATION_DELAY = {
	TITLE: '0.2s',
	SUBTITLE: '0.4s',
	CTA: '0.6s',
	SOCIAL: '0.8s',
	PROJECTS: '1s'
} as const;

export const SOCIAL_LINKS = [
	{
		href: 'https://github.com/Vanishonko',
		label: 'GitHub',
		icon: 'github'
	},
	{
		href: 'https://www.linkedin.com/in/ivan-iliev-931511221/',
		label: 'LinkedIn',
		icon: 'linkedin'
	}
] as const;

export const CV_INFO = {
	path: '/static/IlievIvanCV.pdf',
	filename: 'IlievIvanCV.pdf',
	label: "Download My CV!"
} as const;
